/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

App.prototype.settings = {  
    enable_undo_sales: {
        type : "select",
        id : "enable_undo_sales",
        option_names : ["Yes","No"],
        option_values : ["1","0"],
        required : true,
        selected : "1",
        label : "Enable undo sales for sales persons"
    },
    add_tax: {
        type: "select",
        id : "add_tax",
        option_names: ["Yes", "No"],
        option_values: ["1", "0"],
        required : true,
        selected : "1",
        label : "Add tax as an expense to profit and loss"
    },
    add_comm: {
        type: "select",
        id : "add_comm",
        option_names: ["Yes", "No"],
        option_values: ["1", "0"],
        required : true,
        selected : "1",
        label : "Add commission as an expense to profit and loss"
    },
    add_purchases: {
        type: "select",
        id : "add_purchases",
        option_names: ["Yes", "No"],
        option_values: ["1", "0"],
        required : true,
        selected : "1",
        label : "Add purchases from suppliers to profit and loss"
    },
    track_stock:{
        type: "select",
        id : "track_stock",
        option_names: ["Yes", "No"],
        option_values: ["1", "0"],
        required : true,
        selected : "1",
        label : "Track stock movement"
    },
    user_interface: {
        type: "select",
        id : "user_interface",
        option_names: ["Touch/Modern", "Desktop/Traditional"],
        option_values: ["touch", "desktop"],
        required : true,
        selected : "touch",
        label : "User Interface"
    },
    billing_currency: {
        type: "select",
        id: "billing_currency",
        option_names: ["Kenyan Shilling", "US Dollar"],
        option_values: ["KES", "USD"],
        required: true,
        selected: "ksh",
        label: "Billing Currency"
    },
    no_of_receipts: {
        type : "number",
        id : "no_of_receipts",
        required : true,
        value : 1,
        label : "No of receipts",
        "class" : "form-control"
    },
    receipt_header: {
        type : "text",
        id : "receipt_header",
        required : false,
        value : "",
        label : "Receipt Header",
        "class" : "form-control"
    },
    receipt_footer: {
        type : "text",
        id : "receipt_footer",
        required : false,
        value : "",
        label : "Receipt Footer",
        "class" : "form-control"
    },
    save_btn :{
        type : "button",
        id : "save_btn",
        value : "Save Settings",
        "class" : "btn btn-info",
        style : "margin-top : 20px;",
        events : {
            click : app.saveBusinessSettings
        }
    }
};
