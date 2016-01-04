


App.prototype.updateUser = function () {
    var data = app.getFormData(app.context.user);
    if (!data)
        return;
    var role = data.user_role.value;
    var priv;
    if(role === "admin"){
        priv = ["pos_admin_service", "user_service"];
    }
    else if(role === "intermediate"){
        priv = ["pos_middle_service"];
    }
    else if(role === "seller"){
        priv = ["pos_sale_service"];
    }
    var requestData = {
        user_name: data.email_address.value,
        host: "localhost",
        group: role,
        privs: priv
    };
    app.xhr({
        data : requestData,
        service : "user_service",
        message : "edit_user",
        load: true,
        success: function (data) {
            //say the user was created
            if (data.response.data === "success") {
                app.showMessage(app.context.update_user);
            }
            else if (data.response.data === "fail") {
                app.showMessage(data.response.reason);
            }
            else if (data.response.type === "exception") {
                app.showMessage(data.response.ex_reason);
            }
        },
    });
};



App.prototype.allUsers = function () {
    app.xhr({
        data : {},
        service : "user_service,pos_admin_service",
        message : "all_users,all_users",
        load: true,
        success: function (data) {
            var title = "All Users";
            var names = data.response.pos_admin_service_all_users.data.USER_NAME;
            var userData = data.response.user_service_all_users.data;
            var privs = [];
            var created = [];
            $.each(names,function(index){
                var name = names[index];
                var x = userData.USER_NAME.indexOf(name);
                var priv;
                if (userData.privileges[x].indexOf("pos_admin_service") > -1) {
                    priv = "Admin";
                }
                else if (userData.privileges[x].indexOf("pos_sale_service") > -1) {
                    priv = "Seller";
                }
                else if (userData.privileges[x].indexOf("pos_middle_service") > -1) {
                    priv = "Intermediate";
                }
                privs[index] = priv;
                created[index] = new Date(userData.CREATED[x]).toLocaleDateString();
                
            });
            

            app.paginate({
                title: title,
                save_state: true,
                save_state_area: "content_area",
                onload_handler: app.pages.users,
                onload: function () {
                     app.ui.table({
                        id_to_append : "paginate_body",
                        headers :  ["Email Address", "User Role", "Date Created"],
                        values :  [names, privs,created],
                        include_nums : true,
                        style : "",
                        mobile_collapse : true
                    });
                }
            });
        }
    });
};




App.prototype.saveBusiness = function (actionType) {
    var data,request;
    if (actionType === "create" || actionType === "update") {
        data = app.getFormData(app.context.business);
        if (!data) return;
        var conf = confirm(app.context.business_create_confirm);
        if (!conf) return;
        
        request = {
            action_type: actionType,
            business_name: data.business_name.value,
            country: data.country.value,
            city: data.city.value,
            postal_address: data.postal_address.value,
            phone_number: data.phone_number.value,
            company_website: data.company_website.value,
            business_type: data.business_type.value,
            business_owner: app.appData.formData.login.current_user.name,
            business_descrip: data.business_descrip.value
        };
    }
    else if (actionType === "delete") {
        var conf1 = confirm(app.context.business_delete_confirm);
        if (!conf1) return;
        
        request = {
            action_type: actionType,
            business_owner: localStorage.getItem("business_owner")
        };
    }
   
    var svc = actionType === "delete" ? "privileged_accounts_service,pos_admin_service" : "privileged_accounts_service";
    var msg = actionType === "delete" ? "save_business,delete_business" : "save_business";
    app.xhr({
        data : request,
        service : svc,
        message : msg,
        load: true,
        success: function (data) {
            var resp = actionType === "delete" ? data.response.privileged_accounts_service_save_business.data : data.response.data;
            var reason = actionType === "delete" ? data.response.privileged_accounts_service_save_business.reason : data.response.reason;
            if (resp === "success") {
                app.showMessage(app.context.action_success);
                alert("Business settings changed, please sign in again");
                app.logout();
            }
            else if (resp === "fail") {
                app.showMessage(app.context.action_failed + " : " + reason);
            }
        }
    });
};

