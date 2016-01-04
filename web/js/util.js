App.prototype.formatMoney = function (num) {
    num = parseFloat(num.toString().replace(",", ""));
    var p = num.toFixed(2).split(".");
    var chars = p[0].split("").reverse();
    var newstr = '';
    var count = 0;
    for (var x in chars) {
        count++;
        if (count % 3 === 1 && count !== 1 && chars[x] !== "-") {
            newstr = chars[x] + ',' + newstr;
        } else {
            newstr = chars[x] + newstr;
        }
    }
    return newstr + "." + p[1];
};

App.prototype.keyPad = function (id, display) {
    //initialize a keypad on a specific element
    //load the keypad here
    //display is an id of an input text
    app.loadPage({
        load_url: app.pages.keypad,
        load_area: id,
        onload: function () {
            //initialize the keypad events
            var keys = $(".key");
            $.each(keys, function (x) {
                var key = $(keys[x]);
                var keyVal = key.html();
                key.click(function () {
                    if (keyVal.indexOf("back.png") > -1) {
                        //implement a backspace
                        var currVal = $("#" + display).val(); //09932
                        var newVal = currVal.substring(0, currVal.length - 1);
                        $("#" + display).val(newVal);
                    }
                    else if (keyVal.indexOf("cancel.png") > -1) {
                        //clear everything
                        $("#" + display).val("");
                    }
                    else {
                        app.keyPadType(keyVal, display);
                    }

                });
            });
        }
    });
};

App.prototype.keyPadType = function (keyVal, display) {
    //this is called when the keypad is touched
    var preVal = $("#" + display).val();
    $("#" + display).val(preVal + keyVal);

};

App.prototype.getDim = function () {
    var body = window.document.body;
    var screenHeight;
    var screenWidth;
    if (window.innerHeight) {
        screenHeight = window.innerHeight;
        screenWidth = window.innerWidth;
    }
    else if (body.parentElement.clientHeight) {
        screenHeight = body.parentElement.clientHeight;
        screenWidth = body.parentElement.clientWidth;
    }
    else if (body && body.clientHeight) {
        screenHeight = body.clientHeight;
        screenWidth = body.clientWidth;
    }
    return [screenWidth, screenHeight];
};

App.prototype.getDate = function () {
    var d = new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    m = m < 10 ? "0" + m : m;
    day = day < 10 ? "0" + day : day;
    var y = d.getFullYear();
    return y + "-" + m + "-" + day;
};


App.prototype.fetchItemById = function (options) {
    var request = {
        entity: options.entity,
        columns: options.columns,
        where_cols: options.where_cols(),
        where_values: options.where_values()
    };
    app.xhr({
        data: request,
        service: app.dominant_privilege,
        message: "fetch_item_by_id",
        load: false,
        success: function (data) {
            options.success(data);
        }
    });
};


App.prototype.newGrid = function (options) {
    //data is loaded row by row
    //however we can convert to column by column
    //e.g. [[0,1,2,3],[0,3,4,5]] is treated as row one then row two
    var rows;
    if (options.load_column_by_column) {
        //transform col data to row data here
        rows = [];
        for (var x = 0; x < options.init_data[0].length; x++) {
            rows.push([]);
            for (var y = 0; y < options.col_names.length; y++) {
                rows[x].push(options.init_data[y][x]);
            }
        }
    }
    //if rows is undefined use init_data
    var initData = !rows ? options.init_data : rows;
    var container = $("#" + options.id);
    container.handsontable({
        data: initData,
        rowHeaders: true,
        colHeaders: options.col_names,
        contextMenu: false,
        columns: options.col_types(),
        width: app.getDim()[0] + "px",
        manualColumnResize: true,
        allowInvalid: false,
        afterChange: function (changes, source) {
            if (!changes)
                return;

            if (source === "edit" || source === "autofill") {
                //track edits only
                $.each(changes, function (x) {
                    var row = changes[x][0];
                    var col = changes[x][1];
                    var oldValue = changes[x][2];
                    var newValue = changes[x][3];
                    options.onEdit(row, col, oldValue, newValue);
                });
            }

        },
        cells: function (row, col, prop) {
            var cellProperties = {};
            if (options.disabled && options.disabled.indexOf(col) > -1) {
                cellProperties.readOnly = true;
                cellProperties.renderer = function (instance, td, row, col, prop, value, cellProperties) {
                    Handsontable.TextCell.renderer.apply(this, arguments);
                    td.style.fontWeight = 'bold';
                    td.style.color = 'black';
                    td.style.fontStyle = 'normal';
                    td.innerHTML = value;
                    return cellProperties;
                };
            }
            return cellProperties;
        }
    });

};

App.prototype.formatDate = function (date) {
    var d = new Date(date), month = '' + (d.getMonth() + 1), day = ''
            + d.getDate(), year = d.getFullYear();

    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;

    return [year, month, day].join('-');
};


App.prototype.deepEquals = function (x, y) {
    if (x === y)
        return true;
    // if both x and y are null or undefined and exactly the same

    if (!(x instanceof Object) || !(y instanceof Object))
        return false;
    // if they are not strictly equal, they both need to be Objects

    if (x.constructor !== y.constructor)
        return false;
    // they must have the exact same prototype chain, the closest we can do is
    // test there constructor.

    for (var p in x) {
        if (!x.hasOwnProperty(p))
            continue;
        // other properties were tested using x.constructor === y.constructor

        if (!y.hasOwnProperty(p))
            return false;
        // allows to compare x[ p ] and y[ p ] when set to undefined

        if (x[ p ] === y[ p ])
            continue;
        // if they have the same strict value or identity then they are equal

        if (typeof (x[ p ]) !== "object")
            return false;
        // Numbers, Strings, Functions, Booleans must be strictly equal

        if (!app.deepEquals(x[ p ], y[ p ]))
            return false;
        // Objects and Arrays must be tested recursively
    }

    for (p in y) {
        if (y.hasOwnProperty(p) && !x.hasOwnProperty(p))
            return false;
        // allows x[ p ] to be set to undefined
    }
    return true;

};


