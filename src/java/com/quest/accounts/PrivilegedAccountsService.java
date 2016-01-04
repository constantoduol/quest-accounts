
package com.quest.accounts;

import com.google.appengine.api.datastore.Entity;
import com.google.appengine.api.datastore.Query;
import com.google.appengine.api.datastore.Query.Filter;
import com.google.appengine.api.datastore.Query.FilterPredicate;
import com.quest.access.common.UniqueRandom;
import com.quest.access.common.datastore.Datastore;
import com.quest.access.common.io;
import com.quest.access.control.Server;
import com.quest.access.useraccess.Serviceable;
import com.quest.access.useraccess.services.Message;
import com.quest.access.useraccess.services.annotations.Endpoint;
import com.quest.access.useraccess.services.annotations.WebService;
import com.quest.servlets.ClientWorker;
import java.util.Iterator;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * this was added for privileged access to business data such as saving settings
 * @author conny
 */
@WebService(name = "privileged_accounts_service", level = 10, privileged = "yes")
public class PrivilegedAccountsService implements Serviceable{

    @Override
    public void service() {
        
    }

    @Override
    public void onStart(Server serv) {
        try {
            String initType = serv.getConfig().getInitParameter("init-type");
            if (!initType.equals("initial")) {
                return;
            }
            createNativeBusiness(serv);
        } catch (JSONException ex) {
            Logger.getLogger(AccountsService.class.getName()).log(Level.SEVERE, null, ex);
        }   
    }

    @Override
    public void onPreExecute(Server serv, ClientWorker worker) {
    
    }
    
    @Endpoint(name = "save_settings")
    public void saveSettings(Server serv, ClientWorker worker) {
        JSONObject request = worker.getRequestData();
        String busId = request.optString("business_id");
        Filter filter1 = new FilterPredicate("BUSINESS_ID", Query.FilterOperator.EQUAL, busId);
        request.remove("business_id");
        Iterator iter = request.keys();
        while (iter.hasNext()) {
            String key = iter.next().toString();
            String value = request.optString(key);
            //check that the key exists
            Filter filter2 = new FilterPredicate("CONF_KEY", Query.FilterOperator.EQUAL, key);
            Entity en = Datastore.getSingleEntity("CONF_DATA", filter1, filter2);
            if (en != null) {
                Datastore.updateSingleEntity("CONF_DATA", new String[]{"CONF_VALUE"}, new String[]{value}, filter1, filter2);
            } else {
                Datastore.insert("CONF_DATA",
                        new String[]{"BUSINESS_ID", "CONF_KEY", "CONF_VALUE"},
                        new String[]{busId, key, value});
            }
        }
        worker.setResponseData(Message.SUCCESS);
        serv.messageToClient(worker);
    }
    
   
    
    @Endpoint(name = "save_business")
    public void saveBusiness(Server serv, ClientWorker worker) throws JSONException {
        JSONObject request = worker.getRequestData();
        String name = request.optString("business_name");
        String country = request.optString("country");
        String city = request.optString("city");
        String pAddress = request.optString("postal_address");
        String pNumber = request.optString("phone_number");
        String web = request.optString("company_website");
        String type = request.optString("business_type");
        String owner = request.optString("business_owner");
        String saveType = request.optString("action_type");
        String currentBusId = request.optString("business_id");
        String busCategory = request.optString("business_category");
        String busDescrip = request.optString("business_descrip");
        String bExtra = request.optString("business_extra_data");

        Query.Filter filter1 = new Query.FilterPredicate("BUSINESS_NAME", Query.FilterOperator.EQUAL, name);
        Query.Filter filter2 = new Query.FilterPredicate("BUSINESS_OWNER", Query.FilterOperator.EQUAL, owner);
        boolean exists = Datastore.getSingleEntity("BUSINESS_DATA", filter1, filter2) != null;
        //if this business exists under this owner do not create a new one, just update it
        if (saveType.equals("update")) {
            String[] propNames = new String[]{"BUSINESS_NAME", "COUNTRY", "CITY", "POSTAL_ADDRESS",
                "PHONE_NUMBER", "COMPANY_WEBSITE", "BUSINESS_TYPE", "BUSINESS_CATEGORY", "BUSINESS_DESCRIP", "BUSINESS_EXTRA_DATA"};
            String[] propValues = new String[]{name, country, city, pAddress, pNumber, web, type, busCategory, busDescrip, bExtra};
            Datastore.updateSingleEntity("BUSINESS_DATA", "ID", currentBusId, propNames, propValues, Query.FilterOperator.EQUAL);
        } else if (saveType.equals("create") && !exists) {
            UniqueRandom rand = new UniqueRandom(20);
            String busId = rand.nextMixedRandom();

            String own = worker.getSession() == null ? serv.getRootUser() : worker.getSession().getAttribute("username").toString();
            String[] propNames = new String[]{"ID", "BUSINESS_NAME", "COUNTRY", "CITY", "POSTAL_ADDRESS", "PHONE_NUMBER", "COMPANY_WEBSITE", "BUSINESS_TYPE", "BUSINESS_EXTRA_DATA", "BUSINESS_OWNER", "BUSINESS_CATEGORY", "BUSINESS_DESCRIP", "CREATED"};
            Object[] values = new Object[]{busId, name, country, city, pAddress, pNumber, web, type, bExtra, own, busCategory, busDescrip, System.currentTimeMillis()};

            String[] propNames1 = new String[]{"ID", "USER_NAME", "BUSINESS_ID", "CREATED"};
            Object[] values1 = new Object[]{rand.nextMixedRandom(), own, busId, System.currentTimeMillis()};

            Datastore.insert("BUSINESS_USERS", propNames1, values1);
            Datastore.insert("BUSINESS_DATA", propNames, values);

            //load initial settings for the business
            loadInitSettings(serv, busId);

        } else if (saveType.equals("delete")) {
            //delete user data
            //this is an open service so check for privileges manually here
            //if this is his only business don't delete it
            List entities = Datastore.getMultipleEntitiesAsList("BUSINESS_DATA", "BUSINESS_OWNER", owner, Query.FilterOperator.EQUAL);
            if (entities.size() < 2) {
                worker.setResponseData(Message.FAIL);
                worker.setReason("You cannot delete the only business you have!");
                serv.messageToClient(worker);
                return;
            }
            Datastore.deleteSingleEntity("BUSINESS_DATA", "ID", currentBusId, Query.FilterOperator.EQUAL);
            Datastore.deleteSingleEntity("BUSINESS_USERS", "BUSINESS_ID", currentBusId, Query.FilterOperator.EQUAL);

        }
        worker.setResponseData(Message.SUCCESS);
        serv.messageToClient(worker);
    }
    
    
    private void createNativeBusiness(Server serv) throws JSONException {
        JSONObject request = new JSONObject();
        request.put("business_name", "Quest Test Business");
        request.put("country", "Kenya");
        request.put("city", "Nairobi");
        request.put("postal_address", "30178");
        request.put("phone_number", "0729936172");
        request.put("company_website", "www.questpico.com");
        request.put("business_type", "goods");
        request.put("business_owner", "root@questpico.com");
        request.put("business_descrip", "Initial business");
        request.put("business_extra_data", "extra stuff");
        request.put("action_type","create");
        ClientWorker worker = new ClientWorker("save_business", "open_data_service",null, request, null, null, null);
        worker.setPropagateResponse(false);
        saveBusiness(serv, worker);
    }
    
    private void loadInitSettings(Server serv,String busId) throws JSONException{
        JSONObject request = new JSONObject();
        request.put("enable_undo_sales", "1");
        request.put("add_tax", "0");
        request.put("add_comm", "0");
        request.put("add_purchases", "0");
        request.put("track_stock", "1");
        request.put("user_interface", "touch");
        request.put("no_of_receipts", "1");
        request.put("receipt_header", "");
        request.put("receipt_footer", "");
        request.put("billing_currency", "KES");
        request.put("business_id",busId);
        ClientWorker worker = new ClientWorker("save_settings", "open_data_service",null, request, null, null, null);
        worker.setPropagateResponse(false);
        saveSettings(serv, worker);
    }
}
