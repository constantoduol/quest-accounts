function App() {
    this.appData = new AppData();
    this.pages = {};
    this.platform = "web";
    this.context = null;
    this.sub_context = {};
    this.current_page = "";
    this.ui = new UI();
    this.dominant_privilege = "";
    this.savedState = "";
    this.platform = this.isMobile() ? "mobile" : "web";
    this.server = "/server";
    this.next_url = null;
}

App.prototype.isMobile = function(){
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) 
        return true;
    return false;
};


App.prototype.xhr = function (options) {
    var request = {};
    request.request_header = {};
    var originalService = options.service;
    var originalMessage = options.message;
    request.request_header.request_svc = options.service;
    request.request_header.request_msg = options.message;
    request.request_header.session_id = localStorage.getItem("session_id");
    options.data.business_id = localStorage.getItem("business_id");
    request.request_object = options.data;
    var key = options.service + "_" +options.message;
    if(options.cache){
        //this tells us that we can serve local data if we have it
        //no need for round trips to the server
        //first we check if we have matching service, message and filters locally
        //if not we forward the request to the server
        //pos_admin_service_all_products : 
        var cacheString = localStorage.getItem(key);
        if (cacheString) {
            //var cache = { cache_filters : [{category : 'food'}] , cache_data : [{PRODUCT_NAME : ['milk','bread']}],timestamp : 14153333}
            var cache = JSON.parse(cacheString);
            $.each(options.data,function(item){ //remove nulls and undefined values
                if(!options.data[item]) delete options.data[item];
            });
            for(var x = 0; x < cache.cache_filters.length; x++){
                var equals = app.deepEquals(cache.cache_filters[x], options.data);//we know that this is data for the same request if they are equal
                if(equals){
                    //get the cache data
                    console.log("cached result for : "+key);
                    options.success(cache.cache_data[x]);//trigger an xhr success
                    return;
                }
            }
        }
      //we didnt find a match in the cache so do a full server request  
       
    }
    if (options.load) {
        var loadArea = $("#" + app.context.load_area);
        var loader = $("<img src='img/loader.gif'>");
        loadArea.html(loader);
    }
    
    if(options.cache_refresh){
        //refresh the local cache via a downstream link
        request.request_header.request_svc = request.request_header.request_svc +","+ options.cache_refresh.service;
        request.request_header.request_msg = request.request_header.request_msg +","+options.cache_refresh.message;
        $.extend(request.request_object,options.cache_refresh.filters);//merge what is in cache refresh filters to request_object
    }
    
    if (options.cache_update) {
        //refresh the local cache via a downstream link
        request.request_header.request_svc = request.request_header.request_svc + "," + app.dominant_privilege;
        request.request_header.request_msg = request.request_header.request_msg + "," + "fetch_item_by_id";
        var itemByIdRequest = {
            entity: options.cache_update.entity,
            columns: options.cache_update.columns,
            where_cols: options.cache_update.where_cols(),
            where_values: options.cache_update.where_values()
        };
        $.extend(request.request_object, itemByIdRequest);//merge what is in cache refresh filters to request_object
    }
   
    return $.ajax({
        type: "POST",
        url: app.server,
        data: "json=" + encodeURIComponent(JSON.stringify(request)),
        dataFilter: function (data, type) {
            if (options.load) {
                loadArea.html("");
            }
            console.log(data);
            var data = JSON.parse(data);
            if (data.request_msg === "auth_required") {
                window.location = "index.html";
            }
            return data;
        },
        success: function(data){
            if(options.cache_refresh){
                //transform the data to suit the original request and update the required cache
                //structure of data without cache refresh is data.response.data;
                //structure of data with cache refresh is data.response.service_message.data
                //cache refresh does not support where the original request contains more than one service and message
                var cont1 = {response : {data : ""}};
                var cont2 = {response : {data : ""}};
                var refreshKey = options.cache_refresh.service+"_"+options.cache_refresh.message;
                cont1.response.data  = data.response[originalService+"_"+originalMessage].data;
                cont1.response._cache_status_ = data.response._cache_status_;
                cont2.response.data = data.response[refreshKey].data;
                data = cont1;
                
                //expire the local cache using cont2
                options.cache_refresh.filters.business_id = localStorage.getItem("business_id");
                var cacheString = localStorage.getItem(refreshKey);
                if (cacheString) {
                    var cache = JSON.parse(cacheString);
                    for (var x = 0; x < cache.cache_filters.length; x++) {
                        var equals = app.deepEquals(cache.cache_filters[x], options.cache_refresh.filters);
                        if (equals) {
                            //get the cache data
                            cache.cache_data[x] = cont2;
                            //make the timestamp show that we have new data
                            cache.timestamp = $.now();
                            console.log("cached refresh for : " + refreshKey);
                            localStorage.setItem(refreshKey,JSON.stringify(cache));
                            break;
                        }
                    }
                }
                
            }
            
            if (options.cache_update) {
                //transform the data to suit the original request and update the required cache
                //structure of data without cache refresh is data.response.data;
                //structure of data with cache refresh is data.response.service_message.data
                //cache refresh does not support where the original request contains more than one service and message
                var cont1 = {response: {data: ""}};
                var cont2 = {response: {data: ""}};
                var itemByIdKey = app.dominant_privilege + "_fetch_item_by_id";
                var cacheKey = options.cache_update.cache_key();
                cont1.response.data = data.response[originalService + "_" + originalMessage].data;
                cont1.response._cache_status_ = data.response._cache_status_;
                cont2.response.data = data.response[itemByIdKey].data;
                data = cont1;

                //expire the local cache using cont2
                var cacheString = localStorage.getItem(cacheKey);
                if (cacheString) { //if this does not exist then there is nothing to update
                    var cache = JSON.parse(cacheString);
                    var updatedCache = options.cache_update.updater(cont2,cache);//perform the specific update function
                    if(updatedCache){
                        localStorage.setItem(cacheKey,JSON.stringify(updatedCache));//save the updated cache
                    }
                }
            }
           
            //if we reached here and options.cache is true it means we 
            //didnt have data in the local cache and had to do a server request
            //so now we construct our local cache
            if(options.cache){
                //check that it exists first
                var cacheString = localStorage.getItem(key);
                if(cacheString){
                    var cache = JSON.parse(cacheString);
                    //we have a cache, so just append the current request
                    cache.cache_filters.push(options.data);
                    cache.cache_data.push(data);
                    cache.timestamp = $.now();
                    localStorage.setItem(key,JSON.stringify(cache));
                }
                else {
                    //whoops we dont have a cache yet, create one
                    var cache = { cache_filters : [options.data] , cache_data : [data] ,timestamp : $.now()};
                    localStorage.setItem(key,JSON.stringify(cache));
                }
            }
            
            if(options.success) options.success(data);
            //expire any existing mappings
            
            $.each(data.response._cache_status_,function(key){
                var localTimestamp = !localStorage.getItem(key) ? Infinity : JSON.parse(localStorage.getItem(key)).timestamp;
                var serverTimestamp = parseInt(data.response._cache_status_[key]);
                if(serverTimestamp > localTimestamp){ //if change on server is more recent than data we have here
                    localStorage.removeItem(key);
                }
            });
        },
        error: function(err){
            if (options.load) {
                loadArea.html("");
            }
            if(options.error) options.error(err);
        }
    });
};



App.prototype.ignoreIrrelevantPaths = function(path){
    var len = app.skippable_pages.length;
    var arr = app.skippable_pages;
    var contains = app.skippable_pages.indexOf(path) > -1;
    if(contains){
        return; //this is an irrelevant path;
    }
    else {
        for (var x = 0; x < len; x++) {
            if(path.indexOf(arr[x]) > -1){
                return; //
            }
        }
        app.current_page = path;
    }
};


App.prototype.loadPage = function (options) {
    //options.load_url
    //options.load_area
    //options.onload
    var path = options.load_url;
    app.ignoreIrrelevantPaths(path);
    $("#" + options.load_area).load(path, function () {
        if (app.appData.formData.onload[path]) {
            app.appData.formData.onload[path]();
            app.appData.formData.onload.always();

        }
        if (options.onload) {
            options.onload();
        }
    });
};


App.prototype.currentPage = function(){
    return app.current_page;
};



App.prototype.getFormData = function (formData) {
    var data = {};
    formData = formData.fields;
    var errorSpace = $("#" + app.context.error_space);
    for (var id in formData) {
        var elem = $("#" + id);
        var value = elem.val();
        var sign = formData[id].sign;
        if ((!value || value.trim() === "") && formData[id].required) {
            elem.focus();
            errorSpace.html(formData[id].message);
            app.scrollTo(id);
            return;
        }
        if(sign === "+" && parseFloat(value) < 0){
            elem.focus();
            errorSpace.html("Field should have positive value");
            app.scrollTo(id);
            return; 
        }
        var obj = {};
        obj.value = value;
        data[id] = obj;
    }
    return data;
};



App.prototype.scrollTo = function (id) {
    // Scroll
    if (!$("#" + id)[0])
        return;
    $('html,body').animate({
        scrollTop: $("#" + id).offset().top - 70},
    'slow');
};

App.prototype.getUrlParameter = function (name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
            results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
};


App.prototype.localAutocomplete = function(field,process){
    var auto = field.autocomplete;
    var key = auto.cache_source.service() + "_" + auto.cache_source.message();
    var cacheString = localStorage.getItem(key);
    auto.cache_source.filters.business_id = localStorage.getItem("business_id");
    function cacheSearch(cacheString) {
        var cache = JSON.parse(cacheString);
        var data;
        for(var x = 0; x < cache.cache_filters.length; x++){
            var equal = app.deepEquals(cache.cache_filters[x],auto.cache_source.filters);
            if(equal){
                data = cache.cache_data[x].response.data;
                break;
            }
        }
        field.autocomplete.data = data;
        if(!data) return [];
        //search through the data for matches
        var search = new RegExp(auto.where_values()[0], "i");
        var arr = $.grep(data[auto.key], function (value) {
            return search.test(value);
        });
        var arr = arr.slice(0,auto.limit);
        if (auto.join_to_key) {
            $.each(auto.join_to_key, function (x) {
                var joinKey = auto.join_to_key[x];
                $.each(arr, function (y) {
                    var currValue = arr[y];
                    var index = data[auto.key].indexOf(currValue);
                    var joinValue = data[joinKey][index];
                    arr[y] = arr[y] + "<span style='float:right'>" + joinValue + "</span>";
                });
            });
        }
        return arr;
    }
    if(cacheString){
        //yay, we have the local cache set up a search
        console.log("autocomplete for "+key+" from local cache");
        return process(cacheSearch(cacheString));
    }
    else {
        //we do a full request
        app.xhr({
            data: auto.cache_source.filters,
            service: auto.cache_source.service(),
            message: auto.cache_source.message(),
            load: false,
            cache: true,
            success: function (data) {
                var updatedCacheString = localStorage.getItem(key);
                return process(cacheSearch(updatedCacheString));
            }
        });
    }
};


App.prototype.setUpAuto = function (field) {
    var id = field.autocomplete.id;
    $("#" + id).typeahead({
        source: function (query, process) {
            if(field.autocomplete.cache_source){
                //this autocomplete handler does not need to do a full
                //server request since the required data could be local
                //if the data is not local we do a full server request and cache the data for 
                //subsequent use
                app.localAutocomplete(field,process);
                
            }
            else {
                app.autocomplete(field, function (resp) {
                    var data = resp.response.data;
                    field.autocomplete.data = data;
                    var arr = [];
                    if (!data[field.autocomplete.key])
                        return;
                    $.each(data[field.autocomplete.key], function (x) {
                        var val = data[field.autocomplete.key][x];
                        if (val)
                            arr.push(val);
                    });

                    return process(arr);
                });
            }
        },
        minLength: 1,
        updater: function (item) {
            var data = field.autocomplete.data;
            var key = field.autocomplete.key;
            item = item.indexOf("<span") > -1 ? item.substring(0,item.indexOf("<span")) : item;
            var index = data[key].indexOf(item);
            if (data.ID) {
                $("#" + id).attr("current-item", data.ID[index]);
            }
            else {
                $("#" + id).attr("current-item", item);
            }
            if (field.autocomplete.after)
                field.autocomplete.after(data, index);

            if (field.autocomplete_handler)
                app.defaultAutoHandler(field.autocomplete_handler, data, index);
            return item;
        }
    });
};

App.prototype.paginateSelectItem = function (options) {
    //when this is executed, go back and display the required data
    //so go back
    $("#paginate_navigate").click();
    //then populate the required data
    if (options.afterSelectItem) {
        options.afterSelectItem(options.data, options.index);
    }
    if (options.handler) {
        app.defaultAutoHandler(options.handler, options.data, options.index);
    }

};

App.prototype.paginate = function (options) {
    if (options.save_state) {
        var state = $("#" + options.save_state_area).html();
        app.savedState = state;
    }
    //options.load_url
    //options.load_area
    //options.onload
    app.loadPage({
        load_url: app.pages.paginate,
        load_area: "content_area",
        onload: function () {
            $("#paginate_title").html(options.title);
            $("#paginate_print").click(function () {
                app.print({
                    area: "content_area",
                    title: options.title,
                    beforePrint: function () {
                        //do something cool
                        //remove the headers
                        $("#paginate_button_area").css("display", "none");
                        $("#content_area").css("margin-top", "0px");
                        $("#paginate_card").css("width", "100%");
                        $("#paginate_card").css("border", "0px");
                        var currTitle = $("#paginate_title").html();
                        var newTitle = localStorage.getItem("business_name") + "<br/><br/>" + currTitle;
                        $("#paginate_title").html(newTitle);
                        if (options.beforePrint) {
                            options.beforePrint();
                        }
                        app.runLater(2000, function () {
                            $("#paginate_button_area").css("display", "block");
                            $("#content_area").css("margin-top", "60px");
                            $("#paginate_card").css("width", "90%");
                            $("#paginate_card").css("border", "1px solid rgb(173, 216, 230)");
                            $("#paginate_title").html(currTitle);
                        });
                    }
                });
            });
            //set up paginate_download
            $("#paginate_download").click(function(){
                //set up the first table we find as exportable to excel
                var tableId = $($("table")[0]).attr("id");
                var href = $("#paginate_download");
                return ExcellentExport.excel(href, tableId, options.title);
                
            });
            
            if (options.save_state) {
                $("#paginate_navigate").click(function () {
                    $("#" + options.save_state_area).html(app.savedState);
                    app.savedState = "";
                    var onload = app.appData.formData.onload[options.onload_handler];
                    var always = app.appData.formData.onload.always;
                    if (onload) { //invoke the onload handlers e.g app.pages.sale
                        always();
                        onload();
                    }
                });
            }
            else {
                $("#paginate_navigate").click(function () {
                    app.loadPage({
                        load_url: options.previous,
                        load_area: "content_area"
                    }); // state is not saved in this case so reload the previous page
                });
            }
            if (options.onload) {
                options.onload(); //handle any onload function once we paginate
            }
        }
    });

};



App.prototype.setUpDate = function (id, minDate) {
    $("#" + id).removeClass("hasDatepicker");
    if (minDate) {
        $('#' + id).datepicker({
            dateFormat: "yy-mm-dd",
            showButtonPanel: true,
            changeMonth: true,
            changeYear: true,
            minDate: 0
        });
    }
    else {
        $('#' + id).datepicker({
            dateFormat: "yy-mm-dd",
            showButtonPanel: true,
            changeMonth: true,
            changeYear: true
        });
    }
};

App.prototype.autocomplete = function (field, func) {
    var auto = field.autocomplete;
    var requestData = {
        entity: auto.entity,
        where_cols: auto.where_cols,
        where_values: auto.where_values(),
        where_operators: auto.where_operators,
        column: auto.column,
        orderby: auto.orderby,
        order_direction: auto.order_direction,
        limit: auto.limit
    };
    app.xhr({
        data : requestData,
        service : app.dominant_privilege,
        message : "auto_complete",
        load: false,
        success: function (data) {
            if (data && data.response.data === "FAIL") {
                app.showMessage(data.response.reason);
            }
            else {
                func(data);
            }
        }
    });
};


App.prototype.showMessage = function (msg) {
    var errorSpace = $("#" + app.context.error_space);
    errorSpace.html(msg);
    app.scrollTo(errorSpace.attr('id'));
    app.runLater(5000, function () {
        $("#" + app.context.error_space).html("");
    });
};


App.prototype.runLater = function (time, func) {
    return setTimeout(func, time);
};



App.prototype.print = function (options) {
    options.beforePrint();
    $("#" + options.area).printThis({
        debug: false,
        importCSS: true,
        printContainer: true,
        loadCSS: "/css/pos.css",
        pageTitle: options.title,
        removeInline: false
    });
};

App.prototype.defaultAutoHandler = function (autoHandler, data, index) {
    //{id : key, id : key}

    $.each(autoHandler.fields, function (id) {
        var key = autoHandler.fields[id];
        var value = data[key[0]][index];
        if (key[1] === "date") {
            value = app.formatDate(parseInt(value));
        }
        else if (key[1] === "time") {
            value = new Date(value).toLocaleTimeString();
        }
        else if (key[1] === "datetime") {
            value = new Date(value).toLocaleString();
        }
        else if (key[1] === "money") {
            value = app.formatMoney(value);
        }
        key[2] === "html" ? $("#" + id).html(value) : $("#" + id).val(value); 
    });
};

App.prototype.getSetting = function(name){
    var settings = JSON.parse(localStorage.getItem("settings"));
    if(settings) {
        return settings.CONF_VALUE[settings.CONF_KEY.indexOf(name)];
    }
    else {
        return "0";
    }
};


App.prototype.renderDom = function (obj, toAppend) {
    var elem;
    if (!obj.type)
        return;
    var inputs = ["text", "date", "number", "time", "button"];
    var label = $("<label>");
    label.append(obj.label);
    !obj.label ? null : toAppend.append(label);
    if (obj.type === "select") {
        elem = $("<select>");
        $.each(obj.option_names, function (x) {
            var option = $("<option>");
            option.attr("value", obj.option_values[x]);
            option.html(obj.option_names[x]);
            elem.append(option);
        });
    }
    else if (inputs.indexOf(obj.type.trim()) > -1) {
        elem = $("<input type='" + obj.type + "'>");
        elem.val(obj.value);
    }
    else {
        elem = $(obj.type);
    }
    !obj["class"] ? null : elem.addClass(obj["class"]);
    !obj.style ? null : elem.attr("style", obj.style);
    !obj.id ? null : elem.attr("id", obj.id);
    //bind events
    if (obj.events) {
        //do something
        $.each(obj.events, function (event) {
            elem.bind(event, obj.events[event]);
        });
    }
    toAppend.append(elem);
};

App.prototype.briefShow = function (options) {
    var m = app.ui.modal(options.content, options.title, {
    });
    var delay = !options.delay ? 3000 : options.delay;
    app.runLater(delay, function () {
        m.modal('hide');
    });
};


window.app = new App();