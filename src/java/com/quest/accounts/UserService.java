package com.quest.accounts;

import com.google.appengine.api.datastore.Entity;
import com.google.appengine.api.datastore.Query.Filter;
import com.google.appengine.api.datastore.Query.FilterOperator;
import com.google.appengine.api.datastore.Query.FilterPredicate;
import com.quest.access.useraccess.services.annotations.Endpoint;
import com.quest.access.useraccess.services.annotations.WebService;
import com.quest.access.common.datastore.Datastore;
import com.quest.access.control.Server;
import com.quest.access.useraccess.*;
import com.quest.access.useraccess.services.Message;
import com.quest.access.useraccess.verification.*;
import com.quest.servlets.ClientWorker;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;

import javax.servlet.http.HttpSession;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 *
 * @author constant oduol
 * @version 1.0(23/6/12)
 */
/**
 * this class provides the core services for managing users on a quest access
 * server only users with the required privileges have access to this service.
 * The privilege associated with this service should only be granted to
 * administrators who are assigned to manage users in terms of creating user
 * accounts, deleting user accounts, disabling user accounts, granting and
 * revoking privileges to and from other users etc. The only person with access
 * to this service is the root user who is granted all the privileges
 * automatically at system creation time.
 * <p>
 * <ol>
 * <li>create_user : this is the message sent to the server in order to create a
 * new user</li>
 * <li>delete_user : this message is sent to the server by a client in order to
 * delete a user</li>
 * <li>permanent_delete_user : this message is sent to irreversibly delete a
 * user</li>
 * <li>reset_pass : this message is sent to reset a users password to the
 * default</li>
 * <li>edit_user : this message is sent to edit a users details</li>
 * <li>disable_user: this message is sent to disable a user</li>
 * <li>enable_user : this message is sent to enable a user</li>
 * <li>grant_privilege : this message is sent to grant a user a given
 * privilege</li>
 * <li>revoke_privilege : this message is sent to revoke a privilege from a user
 * </li>
 * <li>undelete_user : this message is sent to request the server to undelete a
 * user</li>
 * <li>rename_deleted_user: this message is sent to the server to rename a
 * deleted user in the USER_HISTORY table</li>
 * <li>single_session : this message is sent to request for the session of a
 * given user</li>
 * <li>many_sessions : this message is sent to request for multiple sessions
 * from the server</li>
 * <li>view_user : this message is sent to the server to request for the details
 * of a given user</li>
 * <li>change_pass : this message is sent to the server to request for a
 * password change</li>
 * <li>verify_action : this message is sent to the server with an action serial
 * in order to verify an action</li>
 * <li>view_action : this message is sent to the server to request for the
 * details of an unverified action</li>
 * <li>delete_action : this message is sent to the server to request for the
 * specified action to be deleted</li>
 * <li>last_action : this message is sent to the server to request for the last
 * unverified action of a user</li>
 * </ol>
 * </p>
 * <p>
 * <ol>
 * <li>create_preset_group : this message tells the server to create a new
 * preset group</li>
 * <li>delete_preset_group : this message tells the server to delete the
 * specified preset group</li>
 * <li>view_preset_group : this message tells the server to send the details of
 * the preset group</li>
 * <li>all_preset_names : this message is sent to retrieve the names of all
 * preset groups</li>
 * <li>all_user_groups : this message is sent to request for the names of all
 * user groups</li>
 * </ol>
 * </p>
 * <p>
 * <ol>
 * <li>action_history : this message is sent to request for a list of a user's
 * actions</li>
 * <li>login_history : this message is sent to request for a list of a user's
 * login history</li>
 * <li>logout_history : this message is sent to request for a list of a user's
 * logout history</li>
 * </ol>
 * </p>
 *
 */
@WebService(name = "user_service", level = 10, privileged = "yes")
public class UserService implements Serviceable {

    @Endpoint(name = "create_user")
    public synchronized User createUser(Server serv, ClientWorker worker) {
        try {
            User user;
            JSONObject details = worker.getRequestData();
            String uName = details.optString("name");
            UserAction uAction = new UserAction(worker, "CREATE_USER " + uName + "");
            String host = details.optString("host");
            JSONArray priv = details.optJSONArray("privs");
            String group = details.optString("group");
            String password = details.optString("password");
            password = password.isEmpty() ? serv.getDefaultPassWord() : password;
            String[] privs = new String[priv.length()];
            for (int x = 0; x < privs.length; x++) {
                privs[x] = priv.get(x).toString().trim();
            }
            try {
                user = new User(uName, password, host, group, uAction, privs);
            } catch (UserExistsException ex) {
                worker.setReason(ex.getMessage());
                worker.setResponseData(ex);
                serv.exceptionToClient(worker);
                return null;
            }

			// save the user apps
            // user.setAccessibleApps(apps);
            worker.setResponseData(Message.SUCCESS);
            serv.messageToClient(worker);
            return user;
        } catch (Exception ex) {
            java.util.logging.Logger.getLogger(UserService.class.getName())
                    .log(Level.SEVERE, null, ex);
            return null;
        }
    }

    @Endpoint(name = "delete_user")
    public void deleteUser(Server serv, ClientWorker worker) {
        try {
            JSONObject requestData = worker.getRequestData();
            String uName = requestData.optString("name");
            HttpSession ses = worker.getSession();
            String name = (String) ses.getAttribute("username");
            if (uName.equals(serv.getRootUser()) || name.equals(uName)) {
                worker.setReason("you cannot delete your own account or a root account ");
                worker.setResponseData(Message.FAIL);
                serv.messageToClient(worker);
                return;
            }
            User.deleteUser(uName);
            Filter filter = new FilterPredicate("USER_NAME", FilterOperator.EQUAL, uName);
            Datastore.deleteSingleEntity("BUSINESS_USERS", filter);
            worker.setResponseData(Message.SUCCESS);
            serv.messageToClient(worker);
            UserAction action = new UserAction(worker, "DELETE_USER "+ uName + "");
            action.saveAction();
        } catch (Exception ex) {
            worker.setResponseData(ex);
            serv.exceptionToClient(worker);
        }
    }

    @Endpoint(name = "edit_host")
    public void editHost(Server serv, ClientWorker worker) {
        JSONObject details = worker.getRequestData();
        String name = (String) details.optString("user_name");
        String host = (String) details.optString("host");
        HttpSession ses = worker.getSession();
        String uName = (String) ses.getAttribute("username");
        if (name.equals(serv.getRootUser()) || name.equals(uName)) {
            worker.setResponseData(Message.FAIL);
            serv.messageToClient(worker);
            return;
        }
        try {
            User user = User.getExistingUser(name);
            user.setUserProperty("HOST", host, true);
            worker.setResponseData(Message.SUCCESS);
            serv.messageToClient(worker);
            UserAction action = new UserAction(worker, "EDIT_HOST " + name + "");
            action.saveAction();
        } catch (Exception ex) {
            worker.setResponseData(ex);
            serv.exceptionToClient(worker);
        }
    }

    @Endpoint(name = "edit_group")
    public void editGroup(Server serv, ClientWorker worker) {
        JSONObject details = worker.getRequestData();
        String name = (String) details.optString("user_name");
        String group = (String) details.optString("group");
        HttpSession ses = worker.getSession();
        String uName = (String) ses.getAttribute("username");
        if (name.equals(serv.getRootUser()) || name.equals(uName)) {
            worker.setResponseData(Message.FAIL);
            serv.messageToClient(worker);
            return;
        }
        try {
            User user = User.getExistingUser(name);
            user.setUserProperty("GROUPS", group, true);
            worker.setResponseData(Message.SUCCESS);
            serv.messageToClient(worker);
            UserAction action = new UserAction(worker, "EDIT_GROUP "+ name + "");
            action.saveAction();
        } catch (Exception ex) {
            worker.setResponseData(ex);
            serv.exceptionToClient(worker);
        }
    }

    @Endpoint(name = "edit_user")
    public synchronized void editUser(Server serv, ClientWorker worker) {
        JSONObject details = worker.getRequestData();
        String name = details.optString("user_name");
        HttpSession ses = worker.getSession();
        String uName = (String) ses.getAttribute("username");
        if (name.equals(serv.getRootUser()) || name.equals(uName)) {
            worker.setReason("you cannot edit a root user account or your own account");
            worker.setResponseData(Message.FAIL);
            serv.messageToClient(worker);
            return;
        }
        String host = details.optString("host");
        String group = details.optString("group");
        JSONArray privs = details.optJSONArray("privs");
        ArrayList userPrivs = new ArrayList();
        try {
            User user = User.getExistingUser(name);
            JSONArray userPrivileges = user.getUserPrivileges();
            userPrivs.addAll(userPrivileges.toList());
            String[] grantPrivs = new String[privs.length()];
            String[] revokePrivs = new String[userPrivs.size()];

            for (int x = 0; x < privs.length(); x++) {
                grantPrivs[x] = privs.get(x).toString().trim();
            }
            for (int x = 0; x < userPrivs.size(); x++) {
                revokePrivs[x] = userPrivs.get(x).toString().trim();
            }
            user.setUserProperty("HOST", host, true);
            user.setUserProperty("GROUPS", group, true);
            user.revokePrivileges(revokePrivs);
            user.grantPrivileges(grantPrivs);
            worker.setResponseData(Message.SUCCESS);
            serv.messageToClient(worker);
            UserAction action = new UserAction(worker, "EDIT_USER "+ name + "");
            action.saveAction();
        } catch (Exception ex) {
            ex.printStackTrace();
            worker.setResponseData(ex);
            serv.exceptionToClient(worker);
        }
    }

    @Endpoint(name = "reset_pass")
    public void resetPassword(Server serv, ClientWorker worker) {
        JSONObject requestData = worker.getRequestData();
        String uName = requestData.optString("name");
        try {
            HttpSession ses = worker.getSession();
            String name = (String) ses.getAttribute("username");
            if (uName.equals(serv.getRootUser()) || name.equals(uName)) {
                worker.setReason("you cannot reset your own password");
                worker.setResponseData(Message.FAIL);
                serv.messageToClient(worker);
                return;
            }
            User user = User.getExistingUser(uName);
            user.setPassWord(serv.getDefaultPassWord());
            worker.setResponseData(Message.SUCCESS);
            serv.messageToClient(worker);
            UserAction action = new UserAction(worker, "RESET_PASS "+ uName + "");
            action.saveAction();
        } catch (Exception ex) {
            worker.setResponseData(ex);
            serv.exceptionToClient(worker);
        }
    }

    @Endpoint(name = "disable_user")
    public void disableUser(Server serv, ClientWorker worker) {
        try {
            JSONObject requestData = worker.getRequestData();
            String uName = requestData.optString("name");
            HttpSession ses = worker.getSession();
            String name = (String) ses.getAttribute("username");
            if (uName.equals(serv.getRootUser()) || name.equals(uName)) {
                worker.setResponseData(Message.FAIL);
                worker.setReason("You cannot disable a root account or your own account");
                serv.messageToClient(worker);
                return;
            }
            User user = User.getExistingUser(uName);
            user.setUserProperty("IS_DISABLED", "1", true);
            worker.setResponseData(Message.SUCCESS);
            serv.messageToClient(worker);
            UserAction action = new UserAction(worker, "DISABLE_USER " + uName + "");
            action.saveAction();
        } catch (Exception ex) {
            worker.setResponseData(ex);
            serv.exceptionToClient(worker);
        }
    }

    @Endpoint(name = "enable_user")
    public void enableUser(Server serv, ClientWorker worker) {
        try {
            JSONObject requestData = worker.getRequestData();
            String uName = requestData.optString("name");
            User user = User.getExistingUser(uName);
            user.setUserProperty("IS_DISABLED", "0", true);
            worker.setResponseData(Message.SUCCESS);
            serv.messageToClient(worker);
            UserAction action = new UserAction(worker, "ENABLE_USER "+ uName + "");
            action.saveAction();
        } catch (Exception ex) {
            worker.setResponseData(ex);
            serv.exceptionToClient(worker);
        }
    }

    @Endpoint(name = "grant_privilege")
    public void grantPrivilege(Server serv, ClientWorker worker) {
        JSONObject details = worker.getRequestData();
        try {
            String priv = details.optString("priv");
            String uName = details.optString("name");
            HttpSession ses = worker.getSession();
            String name = (String) ses.getAttribute("username");
            if (name.equals(uName)) {
                worker.setReason("you cannot grant yourself privileges");
                worker.setResponseData(Message.FAIL);
                serv.messageToClient(worker);
                return;
            }
            User user = User.getExistingUser(uName);
            user.grantPrivileges(priv);
            worker.setResponseData(Message.SUCCESS);
            serv.messageToClient(worker);
        } catch (Exception e) {
            worker.setResponseData(e);
            serv.exceptionToClient(worker);
        }
    }

    @Endpoint(name = "revoke_privilege")
    public void revokePrivilege(Server serv, ClientWorker worker) {
        JSONObject details = worker.getRequestData();
        try {
            String priv = details.optString("priv");
            String uName = details.optString("name");
            HttpSession ses = worker.getSession();
            String name = (String) ses.getAttribute("username");
            if (name.equals(uName)) {
                worker.setReason("you cannot revoke your own privileges");
                worker.setResponseData(Message.FAIL);
                serv.messageToClient(worker);
                return;
            }
            SecurityException sExp = new SecurityException(
                    "group root cannot have specified privileges revoked");
            if ((priv.equals("user_service"))
                    && uName.equals(serv.getRootUser())) {
                worker.setResponseData(sExp);
                serv.exceptionToClient(worker);
            }
            User user = User.getExistingUser(uName);
            user.revokePrivileges(priv);
            worker.setResponseData(Message.SUCCESS);
            serv.messageToClient(worker);
        } catch (Exception e) {
            worker.setResponseData(e);
            serv.exceptionToClient(worker);
        }

    }

    

    @Endpoint(name = "view_user")
    public void getUserDetails(Server serv, ClientWorker worker) {
        JSONObject requestData = worker.getRequestData();
        String userName = requestData.optString("name");
        JSONObject details = new JSONObject();
        try {
            User user = User.getExistingUser(userName);
            details.put("user_data", user.getUserProperties());
            details.put("priv_data", user.getUserPrivileges());
            worker.setResponseData(details);
            serv.messageToClient(worker);
        } catch (Exception ex) {
            worker.setResponseData(ex);
            serv.exceptionToClient(worker);
        }
    }

    @Endpoint(name = "all_users")
    public void allUsers(Server serv, ClientWorker worker) {
        try {
            JSONObject data = Datastore.entityToJSON(Datastore.getAllEntities("USERS"));
            data.remove("PASS_WORD");
            JSONArray privs = new JSONArray();
            JSONArray userNames = data.optJSONArray("USER_NAME");
            for (int x = 0; x < userNames.length(); x++) {
                String name = userNames.optString(x);
                User user = User.getExistingUser(name);
                privs.put(user.getUserPrivileges());
            }
            data.put("privileges", privs);
            worker.setResponseData(data);
            serv.messageToClient(worker);
        } catch (Exception ex) {
            java.util.logging.Logger.getLogger(UserService.class.getName())
                    .log(Level.SEVERE, null, ex);
            worker.setResponseData(ex);
            serv.exceptionToClient(worker);
        }
    }

    @Endpoint(name = "all_user_groups")
    public void getAllUserGroups(Server serv, ClientWorker worker) {
        Iterable<Entity> entities = Datastore.getAllEntities("USERS");
        JSONArray values = new JSONArray();
        for (Entity en : entities) {
            String val = en.getProperty("GROUPS").toString();
            if (!"root".equals(val) || !values.toList().contains(val)) {
                values.put(val);
            }
        }
        worker.setResponseData(values);
        serv.messageToClient(worker);
    }

    @Endpoint(name = "action_history")
    public void actionHistory(Server serv, ClientWorker worker) {
        JSONObject details = worker.getRequestData();
        String name = details.optString("name");
        int limit = details.optInt("limit");
        JSONObject actionHistory = User.getActionHistory(name, limit);
        worker.setResponseData(actionHistory);
        serv.messageToClient(worker);
    }

    @Endpoint(name = "login_history")
    public void loginHistory(Server serv, ClientWorker worker) {
        JSONObject details = worker.getRequestData();
        String name = details.optString("name");
        int limit = details.optInt("limit");
        JSONObject loginHistory = User.getLoginLog(name, limit);
        worker.setResponseData(loginHistory);
        serv.messageToClient(worker);
    }

    @Endpoint(name = "logout_user")
    public void logoutUser(Server serv, ClientWorker worker) {
        try {
            JSONObject details = worker.getRequestData();
            String name = details.optString("name");
            HttpSession currSes = worker.getSession();
            String currUser = (String) currSes.getAttribute("username");
            if (name.equals(currUser)) {
                worker.setReason("you cannot remotely logout your own account");
                worker.setResponseData(Message.FAIL);
                serv.messageToClient(worker);
                return;
            }
            JSONObject logData = new JSONObject();
            logData.put("user_name", name);
            ConcurrentHashMap<String, HttpSession> sessions = Server.getUserSessions();
            HttpSession ses = sessions.get(currSes.getId());
            ClientWorker work = new ClientWorker("logout", "open_data_service",null,logData, ses, null, null);
            serv.doLogOut(work, name);
            worker.setResponseData(Message.SUCCESS);
            serv.messageToClient(worker);
        } catch (JSONException ex) {
            java.util.logging.Logger.getLogger(UserService.class.getName()).log(Level.SEVERE, null, ex);
        }
    }

    @Endpoint(name = "logout_history")
    public void logoutHistory(Server serv, ClientWorker worker) {
        JSONObject details = worker.getRequestData();
        String name = details.optString("name");
        int limit = details.optInt("limit");
        JSONObject logoutHistory = User.getLogoutLog(name, limit);
        worker.setResponseData(logoutHistory);
        serv.messageToClient(worker);
    }

  

    @Override
    public void onStart(Server serv) {

    }

    @Override
    public void service() {

    }

    @Override
    public void onPreExecute(Server serv, ClientWorker worker) {
        
    }

}
