
App.prototype.brand = function(){
  var html = "This product is a trademark of Quest Pico at <a href='http://www.questpico.com'>www.questpico.com</a><br/>Talk to us today at <a href='mailto:info@questpico.com'>info@questpico.com</a>";
  app.ui.modal(html,"About",{
      cancelText : "Done"
  });  
};


App.prototype.login = function () {
    app.context = app.appData.formData.login;
    var data = app.getFormData(app.context);
    localStorage.removeItem("session_id"); //remove the previous session id
    if (!data)
        return;
    var requestData = {
        username: data.username.value,
        password: data.password.value
    };
    app.xhr({
        data : requestData,
        service :  "accounts_service,accounts_service",
        message : "login,business_info",
        load: true,
        success: function (resp) {
            var binfo = resp.response.accounts_service_business_info.data;
            var login = resp.response.accounts_service_login.data;
            if (login.response === "loginsuccess") {
                //get the session id
                localStorage.setItem("session_id", login.rand);
                localStorage.setItem("current_user", login.user);
                localStorage.setItem("privileges", login.privileges);
                localStorage.setItem("host", login.host);
                var nextUrl = !app.next_url ? "main.html" : app.next_url;
                app.navigateBusiness(binfo,nextUrl);
            }
            else if (login === "changepass") {
                window.location = "change.html?user_name=" + data.username.value;
            }
            else {
                app.showMessage(app.context.messages[login]);
            }
        }
    });
    return false;
};

App.prototype.fetchBusinessSettings = function(busId){
  app.xhr({
      data : {},
      service : "accounts_service",
      message : "fetch_settings",
      load : false,
      cache : true,
      success : function(resp){
          var r = resp.response.data;
          localStorage.setItem("settings", JSON.stringify(r));  
      }
  });
};

App.prototype.logout = function () {
    var requestData = {
        user_name: app.appData.formData.login.current_user
    };
    app.xhr({
        data : requestData,
        service : "accounts_service",
        message : "logout",
        load: true,
        success: function (data) {
            //login again
            localStorage.removeItem("session_id");
            localStorage.removeItem("current_user");
            localStorage.removeItem("privileges");
            localStorage.removeItem("host");
            localStorage.removeItem("business_name");
            //localStorage.removeItem("business_id");
            localStorage.removeItem("business_type");
            localStorage.removeItem("business_owner");
            localStorage.removeItem("settings");
            window.location = "index.html";
        },
        error: function () {
            //do something 
            $("#" + app.context.error_space).html(app.context.error_message);
        }
    });
};


App.prototype.changePassword = function () {
    app.context = app.appData.formData.change_pass;
    var data = app.getFormData(app.context);
    if (!data)
        return;
    if (data.new_password.value !== data.confirm_password.value) {
        //do something cool
        app.showMessage(app.context.passwords_not_match);
        return;
    }
    var reg = /^(?=.*\d).{4,50}$/;
    var valid = reg.test(data.confirm_password.value);
    if (!valid) {
        app.showMessage(app.context.password_not_valid);
        return;
    }
    var requestData = {
        user_name: data.user_name.value,
        old_password: data.old_password.value,
        new_password: data.new_password.value,
        confirm_password: data.confirm_password.value
    };
    app.xhr({
        data : requestData,
        service : "accounts_service",
        message : "changepass",
        load: true,
        success: function (data) {
            if (data.response.data === true) {
                //login again
                window.location = "index.html";
            }
            else {
                app.showMessage(app.context.messages["false"]);
            }
        },
        error: function () {
            //do something 
            app.showMessage(app.context.error_message);
        }
    });
    return false;
};





App.prototype.navigateBusiness = function (buss, url) {
    if (buss.business_ids && buss.business_ids.length === 1) {
        localStorage.setItem("business_type", buss.business_types[0]);
        localStorage.setItem("business_name", buss.business_names[0]);
        localStorage.setItem("business_owner", buss.business_owners[0]);
        localStorage.setItem("business_id", buss.business_ids[0]);
        window.location = url;
    }
    else if (buss.business_ids && buss.business_ids.length > 1) {
        var options = "";
        for (var x = 0; x < buss.business_names.length; x++) {
            var option = "<option value=" + buss.business_ids[x] + ">" + buss.business_names[x] + "</option>";
            options = options + option;
        }
        var html = "<select id='select_business_id'>" + options + "</select>";
        app.ui.modal(html, "Select Business", {
            ok: function () {
                var businessId = $("#select_business_id").val();
                var businessType = buss.business_types[buss.business_ids.indexOf(businessId)];
                var businessName = buss.business_names[buss.business_ids.indexOf(businessId)];
                var businessOwner = buss.business_owners[buss.business_ids.indexOf(businessId)];
                localStorage.setItem("business_type", businessType);
                localStorage.setItem("business_name", businessName);
                localStorage.setItem("business_owner", businessOwner);
                localStorage.setItem("business_id", businessId);
                window.location = url;
            },
            cancel: function () {

            },
            okText: "Proceed",
            cancelText: "Cancel"
        });

    }
    else {
        //you have no business at all
        console.log("no business set");
        window.location = url;

    }
};

App.prototype.createAccount = function () {
    app.context = app.appData.formData.create_account;
    var data = app.getFormData(app.context);
    if (!data)
        return;
    if (data.password.value !== data.confirm_password.value) {
        //do something cool
        app.showMessage(app.context.passwords_not_match);
        return;
    }
    var reg = /^(?=.*\d).{4,50}$/;
    var valid = reg.test(data.confirm_password.value);
    if (!valid) {
        app.showMessage(app.context.password_not_valid);
        return;
    }
    app.appData.formData.login.current_user.business_id = "";
    var requestData = {
        name: data.user_name.value,
        password: data.password.value,
        privs: ["pos_admin_service", "user_service", "pos_sale_service","closed_data_service"],
        host: "localhost",
        real_name: data.real_name.value,
        create_type : "external",
        system : "quest_uza",
        next_url : "http://uza.questpico.com"
    };
    app.xhr({
        data : requestData,
        service : "accounts_service",
        message : "create_account",
        load: true,
        success: function (resp) {
            if (resp.response.data === "success") {
                app.ui.modal(app.context.create_account_success, "User Account", {
                    ok: function () {
                        window.location = "index.html";
                    },
                    cancel: function () {
                        window.location = "index.html";
                    },
                    okText: "Proceed",
                    cancelText: "Cancel"
                });
            }
            else if (resp.response.data === "fail") {
                app.showMessage(app.context.create_account_fail);
            }
        },
        error: function () {
            //do something 
            app.showMessage(app.context.error_message);
        }
    });
    return false;
};





App.prototype.generalUserRequest = function (msg) {
    var data = app.getFormData(app.context.user);
    if (!data)
        return;
    var successMsg, confirmMsg;
    if (msg === "delete_user") {
        successMsg = app.context.delete_user;
        confirmMsg = app.context.delete_user_confirm;
    }
    else if (msg === "disable_user") {
        successMsg = app.context.disable_user;
        confirmMsg = app.context.disable_user_confirm;
    }
    else if (msg === "enable_user") {
        successMsg = app.context.enable_user;
        confirmMsg = app.context.enable_user_confirm;
    }
    var conf = confirm(confirmMsg);
    if (!conf)
        return;
    var requestData = {
        name: data.email_address.value,
        system: "quest_uza"
    };
    app.xhr({
        data: requestData,
        service: "user_service",
        message: msg,
        load: true,
        success: function (data) {
            if (data.response.data === "success") {
                app.showMessage(successMsg);
            }
            else if (data.response.type === "exception") {
                app.showMessage(data.response.ex_reason);
            }
            else if (data.response.data === "fail") {
                app.showMessage(data.response.reason);
            }
            //save the local data
        }
    });
};





App.prototype.createUser = function () {
    var data = app.getFormData(app.context.user);
    if (!data)
        return;
    var role = data.user_role.value;
    var priv = role === "admin" ? ["pos_admin_service", "user_service", "privileged_accounts_service"] : ["pos_sale_service"];
    var reg = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/
    var emailValid = reg.test(data.email_address.value);
    if (!emailValid) {
        app.showMessage(app.context.email_invalid);
        $("#email_address").focus();
        return;
    }
    var requestData = {
        name: data.email_address.value,
        host: app.appData.formData.login.current_user.host,
        group: role,
        privs: priv,
        real_name: data.real_name.value,
        create_type: "internal",
        system: "quest_uza",
        next_url: "http://uza.questpico.com"
    };
    app.xhr({
        data: requestData,
        service: "accounts_service",
        message: "create_account",
        load: true,
        success: function (data) {
            if (data.response.data === "success") {
                app.showMessage(app.context.create_user, "green");
            }
            else if (data.response.data === "fail") {
                app.showMessage(data.response.reason);
            }
            else if (data.response.type === "exception") {
                app.showMessage(data.response.ex_reason);
            }
            //save the local data
        }
    });
};

App.prototype.forgotPassword = function () {
    app.context = app.appData.formData.login;
    app.context.load_area = "error_forgot";
    var html = "<label>Enter your account email address to recover your password</label><br/>\n\
                <label id='error_forgot' class='error'></label><br/>\n\
                <label>Email Address</label>\n\
                <input type='email' id='registered_email' class='form-control' placeholder='Email Address'>";
    var m = app.ui.modal(html, "Forgot Password", {
        ok: function () {
            var email = $("#registered_email").val();
            if (!email) {
                $("#error_forgot").html(app.context.businesss_required);
                return;
            }
            var request = {
                username: email,
                next_url: "http://uza.questpico.com"
            };
            app.xhr({
                data: request,
                service: "accounts_service",
                message: "forgot_password",
                load: true,
                success: function (data) {
                    //say the user was created
                    if (data.response.data === "success") {
                        $("#error_forgot").html(app.context.password_reset_success);
                        app.runLater(4000, function () {
                            m.modal('hide');
                        });
                    }
                    else if (data.response.data === "fail") {
                        $("#error_forgot").html(data.response.reason);
                    }
                    else if (data.response.type === "exception") {
                        $("#error_forgot").html(data.response.ex_reason);
                    }
                }
            });

        },
        okText: "Recover Password",
        cancelText: "Cancel"
    });
};


App.prototype.resetPassword = function () {
    var data = app.getFormData(app.context.user);
    if (!data)
        return;
    var requestData = {
        name: data.email_address.value
    };
    app.xhr({
        data: requestData,
        service: "user_service",
        message: "reset_pass",
        load: true,
        success: function (data) {
            if (data.response.data === "success") {
                app.showMessage(app.context.reset_password);
            }
            else if (data.response.data === "fail") {
                app.showMessage(data.response.reason);
            }
            else if (data.response.type === "exception") {
                app.showMessage(data.response.ex_reason);
            }
        }
    });
};
