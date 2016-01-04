function AppData() {
    $(document).ready(function () {
        var path = window.location.pathname;
        app.skippable_pages = [app.pages.paginate, app.pages.account, "/help/"];
        app.appData.formData.onload.once();
        app.appData.formData.onload.always();
        app.ignoreIrrelevantPaths(path);
        if (app.appData.formData.onload[path]) {
            app.appData.formData.onload[path]();
        }
    });
}

AppData.prototype.onload = {
    once: function () {
        //run once when the app loads
        //always enable modal windows
        var modalArea = $("<div id='modal_area'></div>");
        if (!$("#modal_area")[0]) $("body").append(modalArea);
        app.pages.users = "/views/user.html";
        app.pages.business = "/views/business.html";
        app.pages.profile = "/views/profile.html";
        app.pages.paginate = "/views/paginate.html";
        app.loadPage({load_url: app.pages.profile,load_area : 'content_area'})
    },
    always: function () {
        //run always when a page is loaded
        app.appData.formData.onload.setupAccount();

    },
    setupAccount: function () {
        //always shorten the username
        var user = app.appData.formData.login.current_user.name;
        var shortUser;
        if (user && user.length > 20) {
            shortUser = user.substring(0, 20) + "..."; //no overlong usernames
        }
        else {
            shortUser = user;
        }

        //setup account details
        var logoutLink = $("#logout_link");
        logoutLink.html(shortUser);
        logoutLink.unbind("click");
        logoutLink.click(function () {
            var m = app.ui.modal("", "User Account", {
                cancelText: "Cancel",
                cancel: function () {
                    m.modal('hide');
                }
            });
            app.loadPage({
                load_url: app.pages.account,
                load_area: "modal_content_area",
                onload: function () {
                    $("#sign_out_link").click(app.logout);
                    $("#about_link").click(app.brand);
                    $("#activate_link").click(app.activateProduct);
                    $("#help_link").click(function () {
                        app.paginate({
                            title: "Help",
                            save_state: true,
                            save_state_area: "content_area",
                            onload_handler: app.currentPage(),
                            onload: function () {
                                m.modal('hide');
                                app.loadPage({
                                    load_url: app.sub_context.help_url,
                                    load_area: "paginate_body"
                                });
                            }
                        });
                    });

                    $("#change_password_link").click(function () {
                        window.location = "/change.html?user_name=" + user;
                    });

                }
            });
        });
    },
    "/index.html": function () {
        var next_url = app.getUrlParameter("next_url");
        app.next_url = next_url;
        app.context = app.appData.formData.login;
    },
    "/": function () {
        this["/index.html"]();
    },
    "/views/paginate.html": function () {
        //dont show a print button on mobile
        if (app.platform === "mobile") {
            $("#paginate_print").remove();
        }
    },
    "/views/user.html": function () {
        app.context = app.appData.formData.user;
        //app.sub_context = app.context.user;
        $("#create_user_btn").click(app.createUser);
        $("#update_user_btn").click(app.updateUser);
        $("#delete_user_btn").click(function () {
            app.generalUserRequest("delete_user");
        });
        $("#disable_user_btn").click(function () {
            app.generalUserRequest("disable_user");
        });
        $("#enable_user_btn").click(function () {
            app.generalUserRequest("enable_user");
        });
        $("#reset_user_btn").click(app.resetPassword);
        $("#add_category_btn").click(app.addProductCategory);
        $("#search_link").click(app.allUsers);
        app.setUpAuto(app.context.user.fields.search_users);
    },
    "/views/business.html": function () {
        app.context = app.appData.formData.business;
        $("#save_business_btn").click(function () {
            app.saveBusiness("create");
        });
        $("#update_business_btn").click(function () {
            app.saveBusiness("update");
        });
        $("#delete_business_btn").click(function () {
            app.saveBusiness("delete");
        });
        
        $("#settings_business_btn").click(app.loadBusinessSettings);
        
        $("#country").html("");
        $.each(app.nations, function (index) {
            var nation = app.nations[index];
            $("#country").append($("<option value=" + nation + ">" + nation + "</option>"));
        });

        $("#business_category").html("");
        $.each(app.business_categories, function (index) {
            var category = app.business_categories[index];
            $("#business_category").append($("<option value=" + category + ">" + category + "</option>"));
        });
        //load all values for business
        app.xhr({
            data : {},
            service : "accounts_service",
            message : "business_data",
            load: true,
            success: function (data) {
                var resp = data.response.data;
                $("#business_name").val(resp.BUSINESS_NAME[0]);
                $("#country").val(resp.COUNTRY[0]);
                $("#city").val(resp.CITY[0]);
                $("#postal_address").val(resp.POSTAL_ADDRESS[0]);
                $("#phone_number").val(resp.PHONE_NUMBER[0]);
                $("#company_website").val(resp.COMPANY_WEBSITE[0]);
                $("#business_type").val(resp.BUSINESS_TYPE[0]);
                $("#business_category").val(resp.BUSINESS_CATEGORY[0]);
                $("#business_descrip").val(resp.BUSINESS_DESCRIP[0]);

            }
        });
    },
    "/change.html": function () {
        app.context = app.appData.formData.change_pass;
        $("#user_name").val(app.getUrlParameter("user_name"));
        $("#old_password").val(app.getUrlParameter("pass_word"));
    }
};