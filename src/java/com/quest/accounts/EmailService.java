
package com.quest.accounts;

import com.google.appengine.api.datastore.Entity;
import com.google.appengine.api.datastore.Query.Filter;
import com.google.appengine.api.datastore.Query.FilterOperator;
import com.google.appengine.api.datastore.Query.FilterPredicate;
import com.quest.access.common.datastore.Datastore;
import com.quest.access.control.Server;
import com.quest.access.useraccess.Serviceable;
import com.quest.access.useraccess.services.Message;
import com.quest.access.useraccess.services.annotations.Endpoint;
import com.quest.access.useraccess.services.annotations.WebService;
import com.quest.mail.SendGrid;
import com.quest.mail.SendGridException;
import com.quest.servlets.ClientWorker;
import java.io.IOException;
import java.io.InputStream;
import java.util.logging.Level;
import org.apache.commons.io.IOUtils;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 *
 * @author conny
 */

@WebService(name = "email_service", level = 10, privileged = "yes")
public class EmailService implements Serviceable{

    @Override
    public void service() {
       
    }

    @Override
    public void onStart(Server serv) {
        
    }

    @Override
    public void onPreExecute(Server serv, ClientWorker worker) {
       
    }
    
    @Endpoint(name="save_email_template")
    public void saveEmailTemplate(Server serv, ClientWorker worker){
        JSONObject request = worker.getRequestData();
        String body = request.optString("body");
        String subj = request.optString("subject");
        String emailKey = request.optString("email_key");
        boolean exists = Datastore.exists("EMAILS", new String[]{"EMAIL_KEY"}, new String[]{emailKey});
        if(exists){
            worker.setReason("Email specified by key already exists");
            worker.setResponseData(Message.FAIL);
            serv.messageToClient(worker);
        }
        else {
            Datastore.insert("EMAILS", 
                    new String[]{"EMAIL_KEY","SUBJECT","BODY","TIMESTAMP"}, 
                    new Object[]{emailKey,subj,body,serv.timestamp()});
            serv.messageToClient(worker.setResponseData(Message.SUCCESS));
        }
    }
    
    @Endpoint(name = "get_email_template")
    public void getEmailTemplate(Server serv, ClientWorker worker) {
        JSONObject request = worker.getRequestData();
        String emailKey = request.optString("email_key");
        Filter filter = new FilterPredicate("EMAIL_KEY", FilterOperator.EQUAL, emailKey);
        Entity singleEntity = Datastore.getSingleEntity("EMAILS", filter);
        serv.messageToClient(worker.setResponseData(Datastore.entityToJSON(singleEntity)));
    }    
    
    @Endpoint(name = "delete_email_template")
    public void deleteEmailTemplate(Server serv, ClientWorker worker) {
        JSONObject request = worker.getRequestData();
        String emailKey = request.optString("email_key");
        Filter filter = new FilterPredicate("EMAIL_KEY", FilterOperator.EQUAL, emailKey);
        Datastore.deleteSingleEntity("EMAILS", filter);
        serv.messageToClient(worker.setResponseData(Message.SUCCESS));
    }
    
    @Endpoint(name="send_email")
    public void sendEmail(Server serv, ClientWorker worker){
        JSONObject request = worker.getRequestData();
        String senderName = request.optString("sender_name");
        String senderEmail = request.optString("sender_email");
        String toName = request.optString("to_name");
        String toEmail = request.optString("to_email");
        String emailKey = request.optString("email_key");
        JSONArray replaceKeys = request.optJSONArray("replace_keys");
        JSONArray replaceValues = request.optJSONArray("replace_values");
        String subject = "",body = "";
        if(emailKey.isEmpty()){
           subject = request.optString("subject");
           body = request.optString("body");   
        }
        else {
            Filter filter = new FilterPredicate("EMAIL_KEY", FilterOperator.EQUAL, emailKey);
            Entity en = Datastore.getSingleEntity("EMAILS", filter);
            if(en != null){
                subject = en.getProperty("SUBJECT").toString();
                body = en.getProperty("BODY").toString();
            }
        }
        if(replaceKeys != null){
            for(int x = 0; x < replaceKeys.length(); x++){
                String key = replaceKeys.optString(x);
                String value = replaceValues.optString(x);
                body = body.replace(key, value);
            }
        }
        String[] from = new String[]{senderEmail,senderName};
        String emailIdentifier = toEmail.substring(0,toEmail.indexOf("@"));
        boolean isQuestAccount = toEmail.contains("questpico.com");
        if(emailIdentifier.equals("all_customers") && isQuestAccount){
            Iterable<Entity> allEntities = Datastore.getAllEntities("SYSTEM_USERS");
            for(Entity en : allEntities){
                String email = en.getProperty("EMAIL").toString();
                String name = en.getProperty("NAME").toString();
                String[] to = new String[]{email, name};
                sendEmail(from, to, subject, body,serv);
                Datastore.insert("EMAIL_STATS",new String[]{"EMAIL","NAME","TIMESTAMP"},new Object[]{email,name,serv.timestamp()});
            }
        }
        else if(isQuestAccount){
            //this is for a sub system within questpico
            Filter filter = new FilterPredicate("SYSTEM", FilterOperator.EQUAL,emailIdentifier);
            Iterable<Entity> multipleEntities = Datastore.getMultipleEntities("SYSTEM_USERS", filter);
            for (Entity en : multipleEntities) {
                String email = en.getProperty("EMAIL").toString();
                String name = en.getProperty("NAME").toString();
                String[] to = new String[]{email, name};
                sendEmail(from, to, subject, body,serv);
                Datastore.insert("EMAIL_STATS",new String[]{"EMAIL","NAME","TIMESTAMP"},new Object[]{email,name,serv.timestamp()});
            }
        }
        else {
            String[] to = new String[]{toEmail,toName};
            sendEmail(from, to, subject, body,serv); 
            Datastore.insert("EMAIL_STATS",new String[]{"EMAIL","NAME","TIMESTAMP"},new Object[]{toEmail,toName,serv.timestamp()});
        }
        serv.messageToClient(worker.setResponseData(Message.SUCCESS));
    }
    
    public String getEmailTemplate(String name) {
        try {
            InputStream in = getClass().getResourceAsStream("/com/quest/mail/" + name + ".html");
            return IOUtils.toString(in, "utf-8");
        } catch (IOException ex) {
            java.util.logging.Logger.getLogger(Server.class.getName()).log(Level.SEVERE, null, ex);
            return "";
        }
    }
    
    /**
     *
     * @param from contains the email and preferred name of the sender
     * @param to contains the email and preferred name of recipient
     * @param subject contains the subject of the email to be sent
     * @param msgBody this is the message to send
     */
    public void sendEmail(String[] from, String[] to, String subject, String msgBody,Server serv) {
        String userName = serv.getConfig().getInitParameter("sendgrid-username");
        String pass = serv.getConfig().getInitParameter("sendgrid-password");
        SendGrid sendgrid = new SendGrid(userName, pass);
        SendGrid.Email email = new SendGrid.Email();
        email.addTo(to[0]);
        email.addToName(to[1]);
        email.setFrom(from[0]);
        email.setFromName(from[1]);
        email.setSubject(subject);
        email.setHtml(msgBody);
        try {
            SendGrid.Response response = sendgrid.send(email);
            System.out.println(response.getMessage());
        } catch (SendGridException e) {
            System.err.println(e);
        }
    }

}
