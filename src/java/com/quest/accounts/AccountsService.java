/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package com.quest.accounts;

import java.io.IOException;
import java.net.UnknownHostException;
import java.util.HashMap;

import javax.servlet.ServletConfig;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import com.google.appengine.api.datastore.Entity;
import com.google.appengine.api.datastore.Query.Filter;
import com.google.appengine.api.datastore.Query.FilterOperator;
import com.google.appengine.api.datastore.Query.FilterPredicate;
import com.quest.access.common.UniqueRandom;
import com.quest.access.common.io;
import com.quest.access.common.datastore.Datastore;
import com.quest.access.control.Server;
import com.quest.access.useraccess.NonExistentUserException;
import com.quest.access.useraccess.Serviceable;
import com.quest.access.useraccess.User;
import com.quest.access.useraccess.services.Message;
import com.quest.access.useraccess.services.annotations.Endpoint;
import com.quest.access.useraccess.services.annotations.WebService;
import com.quest.access.useraccess.verification.UserAction;
import com.quest.servlets.ClientWorker;

/**
 *
 * @author Connie
 */
@WebService(name = "accounts_service", level = 10, privileged = "no")
public class AccountsService implements Serviceable {
    

    @Endpoint(name = "fetch_settings",cacheModifiers = {"open_data_service_save_settings"})
    public void fetchSettings(Server serv, ClientWorker worker) {
        JSONObject request = worker.getRequestData();
        String busId = request.optString("business_id");
        Filter filter1 = new FilterPredicate("BUSINESS_ID", FilterOperator.EQUAL, busId);
        JSONObject data = Datastore.entityToJSON(Datastore.getMultipleEntities("CONF_DATA", filter1));
        worker.setResponseData(data);
        serv.messageToClient(worker);
    }


    @Endpoint(name = "business_info")
    public JSONObject getBusinessInfo(Server serv, ClientWorker worker) throws JSONException {
        //we need to get the business id
        JSONObject request = worker.getRequestData();
        String email = request.optString("username");
        Filter filter1 = new FilterPredicate("USER_NAME", FilterOperator.EQUAL, email);
        JSONObject data = Datastore.entityToJSON(Datastore.twoWayJoin(
                new String[]{"BUSINESS_USERS", "BUSINESS_DATA"},
                new String[]{"BUSINESS_ID", "ID"}, null, null,
                new Filter[]{filter1}, new Filter[]{}));
        JSONObject response = new JSONObject();
        response.put("business_ids", data.optJSONArray("BUSINESS_ID"));
        response.put("business_names", data.optJSONArray("BUSINESS_NAME"));
        response.put("business_types", data.optJSONArray("BUSINESS_TYPE"));
        response.put("business_extra_data", data.optJSONArray("BUSINESS_EXTRA_DATA"));
        response.put("business_owners", data.optJSONArray("BUSINESS_OWNER"));
        worker.setResponseData(response);
        serv.messageToClient(worker);
        return response;
    }
    


    @Endpoint(name = "business_data")
    public void businessData(Server serv, ClientWorker worker) throws JSONException {
        //we need to get the business id
        JSONObject request = worker.getRequestData();
        String id = request.optString("business_id");
        Filter filter1 = new FilterPredicate("ID", FilterOperator.EQUAL, id);
        JSONObject data = Datastore.entityToJSONArray(Datastore.getSingleEntity("BUSINESS_DATA", filter1));
        worker.setResponseData(data);
        serv.messageToClient(worker);
    }


    private boolean hasPrivilege(String privilege, ClientWorker worker) {
        JSONArray privs = (JSONArray) worker.getSession().getAttribute("privileges");
        if (privs == null) {
            return false;
        }
        return privs.toList().contains(privilege);
    }


    
    @Endpoint(name="verify_forgot_password")
    public void verifyForgotPassword(Server serv, ClientWorker worker) throws Exception{
        //get the action id and check that we have such an id
        JSONObject request = worker.getRequestData();
        String actionId = request.optString("action_id");
        String email = request.optString("email");
        String nextUrl = request.optString("next_url");
        boolean exists = Datastore.exists("USER_ACTIONS",new String[]{"ACTION_ID"},new String[]{actionId});
        if(exists){
            //this is a valid forgot password
            //reset the password
            User user = User.getExistingUser(email);
            String pass = new UniqueRandom(6).nextMixedRandom();
            user.setPassWord(pass);
            user.setUserProperty("CHANGE_PASSWORD", "1", true);//force a password reset
            Filter filter = new FilterPredicate("ACTION_ID", FilterOperator.EQUAL, actionId);
            Datastore.deleteSingleEntity("USER_ACTIONS", filter);//expire this link
            String link = nextUrl +"/change.html?user_name="+email+"&pass_word="+pass;
            worker.getResponse().sendRedirect(link);
        }
        else {
            String html = "Link is expired or is invalid!<br>"
                    + "Click the following link to proceed<br><a href="+nextUrl+">"+nextUrl+"</a>";
            worker.getResponse().getWriter().print(html);
        }
    }

    @Endpoint(name = "forgot_password")
    public void forgotPassword(Server serv, ClientWorker worker) throws JSONException{
        try {
            JSONObject details = worker.getRequestData();
            String email = details.optString("username");
            String nextUrl = details.optString("next_url");
            //check locally to see whether its valid
            User user = User.getExistingUser(email);
            EmailService es = new EmailService();
            String body = es.getEmailTemplate("forgot-password");
            String senderEmail = serv.getConfig().getInitParameter("sender-email");
            
            UserAction action = new UserAction(worker, "Password reset for " + email);
            String actionId = action.getActionID();
            String resetLink = nextUrl + "?svc=open_data_service&msg=verify_forgot_password&"
                    + "next_url="+nextUrl+"&email=" + email + "&action_id=" + actionId;
            
            JSONObject rq = new JSONObject();
            rq.put("subject", "Password Reset");
            rq.put("sender_name", "Quest Pico");
            rq.put("sender_email", senderEmail);
            rq.put("to_name",email);
            rq.put("to_email", email);
            rq.put("body", body);
            rq.put("replace_keys", new JSONArray("['{user_name}','{change_link}']"));
            rq.put("replace_values", new JSONArray("['"+email+"','"+resetLink+"']"));
            worker.setPropagateResponse(false);
            es.sendEmail(serv, worker);
            worker.setPropagateResponse(true);
            worker.setResponseData(Message.SUCCESS);
            serv.messageToClient(worker);
            action.saveAction();
        } catch (NonExistentUserException ex) {
            worker.setResponseData(Message.FAIL);
            worker.setReason("The specified email address does not belong to any account");
            serv.messageToClient(worker);
        }
    }

    @Endpoint(name = "create_account")
    public void createAccount(Server serv, ClientWorker worker) throws Exception {
        JSONObject details = worker.getRequestData();
        String uName = details.optString("name");
        String realName = details.optString("real_name");
        String busId = details.optString("business_id");
        String createType = details.optString("create_type");
        String nextUrl = details.optString("next_url");
        //if busId is empty, this is a business owner trying to create an account
        UserService us = new UserService();
        EmailService es = new EmailService();
        worker.setPropagateResponse(false);
        User user = us.createUser(serv, worker);
        ServletConfig config = serv.getConfig();
        if (user != null) {

            String senderEmail = config.getInitParameter("sender-email");
            UserAction action = new UserAction(worker, uName);
            String actionId = action.getActionID();
            String questAccountsUrl = serv.getRegisteredSystems().get("quest_accounts");
            String link = questAccountsUrl + "?svc=open_data_service&msg=activate_account&user_name="+uName+"&"
                                          + "action_id="+actionId+"&business_id="+busId+"&next_url="+nextUrl;
            String href = "<a href=" + link + ">Click to Activate</a>";
            String email;
            if (createType.equals("external")) {
                //this is a completely new account since no business id is 
                //specified
                email = es.getEmailTemplate("new-user-account");
                
            } 
            else {
                //this is a subsequent account created by the business owner for
                //a staff for example
                email = es.getEmailTemplate("new-user-account-sub");
                String pass = new UniqueRandom(6).nextMixedRandom();
                email = email.replace("{pass_word}", pass);
                user.setPassWord(pass);
                user.setUserProperty("CHANGE_PASSWORD", "1", true); //force a password change
            }
            
            JSONObject rq = new JSONObject();
            rq.put("sender_name", "Quest Pico");
            rq.put("sender_email", senderEmail);
            rq.put("to_name", realName);
            rq.put("to_email", uName);
            rq.put("subject", "New Account");
            rq.put("body", email);
            JSONArray replaceKeys = new JSONArray("['{real_name}','{user_name}','{activation_link}']");
            JSONArray replaceValues = new JSONArray("['"+realName+"','"+uName+"','"+href+"']");
            rq.put("replace_keys", replaceKeys);
            rq.put("replace_values", replaceValues);
            worker.setRequestData(rq);
            es.sendEmail(serv, worker);
            user.setUserProperty("IS_DISABLED", "1", true);
            //update his real name in the db
            user.setUserProperty("REAL_NAME", realName, true);
            //disable the user
            action.saveAction();
            worker.setResponseData(Message.SUCCESS);
            saveUserToSystem(serv, details);
        } else {
            worker.setResponseData(Message.FAIL);
            saveUserToSystem(serv, details);
        }
        worker.setPropagateResponse(true);
        serv.messageToClient(worker);
    }
    
    private void saveUserToSystem(Server serv,JSONObject request){
        String system = request.optString("system");
        String email = request.optString("name");
        String realName = request.optString("real_name");
        boolean exists = serv.getRegisteredSystems().containsKey(system);
        if(exists){
            boolean userExists = Datastore.exists("SYSTEM_USERS",new String[]{"EMAIL"},new String[]{email});
            if(!userExists){
                Datastore.insert("SYSTEM_USERS", 
                        new String[]{"SYSTEM", "EMAIL", "NAME", "TIMESTAMP"}, 
                        new Object[]{system, email, realName, serv.timestamp()});   
            }
        }
    }

    @Endpoint(name = "activate_account")
    public void activateAccount(Server serv, ClientWorker worker) throws IOException, NonExistentUserException {
        JSONObject details = worker.getRequestData();
        String email = details.optString("user_name");
        String actionId = details.optString("action_id");
        String nextUrl = details.optString("next_url");
        String busId = details.optString("business_id");
        User user = User.getExistingUser(email);
        //first check if the specified user is already activated
        boolean userExists = !user.getUserProperty("USER_NAME").isEmpty();
        if (!userExists) {
            worker.setResponseData(Message.FAIL);
            worker.setReason("User account seems to be invalid");
            serv.messageToClient(worker);
            return;
        }

        boolean userDisabled = user.getUserProperty("IS_DISABLED").equals("1");
        if (!userDisabled) {
            //if the user is not disabled, it means this account has already been activated
            String html = "Account already active, click the below link to proceed <br>"
                    + "<a href='"+nextUrl+">"+nextUrl+"</a>'";
            worker.getResponse().getWriter().print(html);
            return;
        }
        //here we are dealing with a disabled user
        //check that the action id matches what we have
        HashMap<String, Object> actionDetails = UserAction.getActionDetails(actionId);
        String userName = actionDetails.get("ACTION_DESCRIPTION").toString();
        //if userName === email then we are happy
        if (userName.equals(email)) {
            //well this is a valid activation,do something cool
            //send a redirect to the next url
            //add to specified business
            //enable the user
            user.setUserProperty("IS_DISABLED", "0", true);
            String id = new UniqueRandom(20).nextMixedRandom();
            if (!busId.trim().isEmpty()) {
                String[] propNames1 = new String[]{"ID", "USER_NAME", "BUSINESS_ID", "CREATED"};
                Object[] values1 = new Object[]{id, email, busId, System.currentTimeMillis()};
                Datastore.insert("BUSINESS_USERS", "ID", propNames1, values1);
            }
            worker.getResponse().sendRedirect(nextUrl);
        }
    }






    public static void main(String[] args) {
        String limit = "300-500";
        Integer limitOne = Integer.parseInt(limit.substring(0, limit.indexOf("-")));
        Integer limitTwo = Integer.parseInt(limit.substring(limit.indexOf("-")+1, limit.length()));
        io.out(limitOne);
        io.out(limitTwo);
        
        
    }


    @Endpoint(name = "logout")
    public void logout(Server serv, ClientWorker worker) {
        JSONObject requestData = worker.getRequestData();
        String userName = requestData.optString("user_name");
        serv.doLogOut(worker, userName);
        worker.setResponseData("success");
        serv.messageToClient(worker);
    }

    @Endpoint(name = "login")
    public void login(Server serv, ClientWorker worker) throws JSONException, UnknownHostException {
        JSONObject requestData = worker.getRequestData();
        String remoteAddr = worker.getRequest().getRemoteAddr();
        requestData.put("clientip", remoteAddr);
        serv.doLogin(worker);
    }

    @Endpoint(name = "changepass")
    public void changePass(Server serv, ClientWorker worker) {
        JSONObject requestData = worker.getRequestData();
        String userName = requestData.optString("user_name");
        String oldPass = requestData.optString("old_password");
        String newPass = requestData.optString("new_password");
        Boolean change = User.changePassword(userName, oldPass, newPass);
        worker.setResponseData(change);
        serv.messageToClient(worker);
    }
    
    

    @Override
    public void service() {

    }

    @Override
    public void onPreExecute(Server serv, ClientWorker worker) {

    }

    @Override
    public void onStart(Server serv) {
     
    }

    
    @Endpoint(name = "migrate_entities")
    public void migrateEntities(Server serv, ClientWorker worker){
        //current PRODUCT_DATA
        //EXTRA COLUMNS PRODUCT_DATA
        //PRODUCT_CATEGORY,PRODUCT_SUB_CATEGORY,PRODUCT_PARENT,PRODUCT_UNIT_SIZE,TAX,COMMISSION
        Iterable<Entity> allEntities = Datastore.getAllEntities("PRODUCT_DATA");
        for(Entity en : allEntities){
            String prodType = en.getProperty("PRODUCT_TYPE").toString();
            en.setProperty("PRODUCT_CATEGORY", prodType);
            en.setProperty("PRODUCT_SUB_CATEGORY",prodType);
            en.setProperty("TAX",0.0);
            en.setProperty("COMMISSION", 0.0);
            en.setProperty("PRODUCT_UNIT_SIZE",1.0);
            en.setProperty("PRODUCT_PARENT","");
            en.removeProperty("PRODUCT_TYPE");
            Datastore.insert(en);
        }
        worker.setResponseData(Message.SUCCESS);
        serv.messageToClient(worker);
    }
}
