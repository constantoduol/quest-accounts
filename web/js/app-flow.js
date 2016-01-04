AppData.prototype.formData = {
    onload: AppData.prototype.onload,
    login: {
        fields: {
            username: {required: true, message: "Email address is required"},
            password: {required: true, message: "Password is required"}
        },
        error_space: "error_space_login",
        load_area: "error_space_login",
        error_message: "The server is unavailable or you have no network connection",
        businesss_required: "Both email and business name are required!",
        password_reset_success: "An email has been sent to your address, use it to reset your password",
        current_user: {
            name: localStorage.getItem("current_user"),
            host: localStorage.getItem("host"),
            business_type: localStorage.getItem("business_type")
        },
        messages: {
            invalidpass: "The password you entered is invalid",
            notexist: "User account does not exist",
            disabled: "User account has been disabled"
        }
    },
    create_account: {
        fields: {
            user_name: {required: true, message: "Email address is required"},
            real_name: {required: true, message: "Name is required"},
            password: {required: true, message: "Password is required"},
            confirm_password: {required: true, message: "Confirm password is required"}
        },
        error_space: "error_space_create",
        load_area: "error_space_create",
        error_message: "The server is unavailable or you have no network connection",
        passwords_not_match: "The passwords entered do not match",
        password_not_valid: "Password should be more than 4 characters, have at least one number and be less than 50 characters",
        create_account_success: "User account was created successfully, check your email to activate your account",
        create_account_fail: "User account already exists, try a different email address"
    },
    change_pass: {
        fields: {
            user_name: {required: true, message: "Email address is required"},
            old_password: {required: true, message: "Old password is required"},
            new_password: {required: true, message: "New password is required"},
            confirm_password: {required: true, message: "Confirm password is required"}
        },
        error_space: "error_space_login",
        load_area: "error_space_login",
        error_message: "The server is unavailable or you have no network connection",
        passwords_not_match: "New password and confirm password do not match",
        password_not_valid: "Password should be more than 4 characters, have at least one number and be less than 50 characters",
        messages: {
            false: "The old password entered is invalid"
        }
    },
    user: {
        fields: {
            search_users: {
                autocomplete: {
                    id: "search_users",
                    entity: "BUSINESS_USERS",
                    column: ["USER_NAME", "ID"],
                    where_cols: ["USER_NAME"],
                    where_values: function () {
                        return [$("#search_users").val()];
                    },
                    where_operators: [">="],
                    orderby: "USER_NAME",
                    order_direction: "ASC",
                    limit: 10,
                    key: "USER_NAME",
                    data: {},
                    after: function (data, index) {
                        var name = data.USER_NAME[index];
                        $("#email_address").val(name);
                        var request = {
                            name: name
                        };
                        app.xhr({
                            data: request,
                            service: "user_service",
                            message: "view_user",
                            load: false,
                            success: function (data) {
                                var privs = data.response.data.priv_data;
                                if (privs.indexOf("pos_admin_service") > -1) {
                                    $("#user_role").val("admin");
                                }
                                else {
                                    $("#user_role").val("seller");
                                }
                            },
                            error: function () {
                                //do something fun
                                app.showMessage(app.context.error_message);
                            }
                        });
                    }
                }
            },
            email_address: {required: true, message: "Email address is required"},
            user_role: {required: true, message: "User role is required"},
            real_name: {required: false}
        },
        create_user: "User created successfully, user should check email for login credentials",
        email_invalid: "The email address entered is invalid",
        update_user: "The user was updated successfully",
        delete_user: "The user was deleted successfully",
        delete_user_confirm: "Delete user ? This action cannot be undone",
        disable_user: "The user account was disabled successfully",
        disable_user_confirm: "Disable user account?",
        enable_user: "The user account was enabled successfully",
        enable_user_confirm: "Enable user account?",
        reset_password: "User password reset successfully",
        error_message: "The server is unavailable or you have no network connection"
    },
    settings: {
        fields: {
            enable_undo_sales: {required: true},
            add_tax: {required: true},
            add_comm: {required: true},
            add_purchases: {required: true},
            track_stock: {required: true},
            user_interface: {required: false}
        }
    },
    business: {
        fields: {
            business_name: {required: true, message: "Business name is required"},
            country: {required: true, message: "Country is required"},
            city: {required: true, message: "City is required"},
            postal_address: {required: false},
            phone_number: {required: false},
            company_website: {required: false},
            business_type: {required: true, message: "Business type is required"},
            business_category: {required: true, message: "Business category is required"},
            business_descrip: {required: false}
        },
        business_create_confirm: "Create a new Business ?",
        business_delete_confirm: "Delete business? You will lose all records for this business",
        business_deleted_success: "Business deleted successfully",
        business_saved: "Business details saved successfully"
    }
};
