// Copyright WEBMARK EUROPE
// www.webmark-europe.com

var emulate = false;
var debug = false;

var randomnumber = Math.floor(Math.random()*11000000);
var connectionRequired = false;
var connectionLost = false;
var screenHistory = new Array();
var theScroll;
var timerCover;
var contentReady = true;
var currentUpdateTimeStamp;

var appUrl = "http://app.korokesborok.heviz.hu/";
var appLang = "";

var appPath;

var errorMessages1Counter = 0;
var errorMessages1 = new Array();
errorMessages1.push("Az app tartalmának a letöltéséhez Internet kapcsolat szükséges.");
errorMessages1.push("Network connection is needed for content update.");

var app = {
    // Application Constructor
    initialize: function() {
        this.bindEvents();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicitly call 'app.receivedEvent(...);'
    onDeviceReady: function() {
        app.receivedEvent('deviceready');
        
        //window.localStorage.setItem("lastUpdated", "");
        
        StatusBar.overlaysWebView(false);
        StatusBar.hide();
        appInit();
    },
    
    // Update DOM on a Received Event
    receivedEvent: function(id) {
        console.log('Received Event ' + id);        
    },
    
    initUrls: function() {
        $('a').click(function(e) {
            e.preventDefault();        
            var nextPage = $(this).attr("href");
            var setLang = $(this).attr("lang");
            
            if (setLang != undefined) {
                app.log("appLang set to " + setLang);
                window.localStorage.setItem("appLang", setLang);
            }
            
            if (nextPage != undefined) {
                app.goToPage(nextPage);
            }
        });        
    },
    
    updateContent: function() {
        app.log("connetction status is " + checkConnection());
        app.log("start loading app content");
        
        // check for update
        var lastUpdated = window.localStorage.getItem("lastUpdated");
        // we don't have any actual content
        if (lastUpdated == undefined) {
            // check connection
            if (checkConnection() == false) {
                app.log("connection error! quiting...");
                $("#loading").show();
                $("#loading img").hide();
                
                $("#progress").html(errorMessages1[errorMessages1Counter]);
                var checkConnectionProgressBar = setInterval(function() {
                    errorMessages1Counter = errorMessages1Counter + 1;
                    $('#progress').fadeOut('slow', function() {
                        $('#progress').html(errorMessages1[errorMessages1Counter]);
                        $('#progress').fadeIn('slow');
                        if (errorMessages1Counter == (errorMessages1.length-1)) {
                            errorMessages1Counter = -1;
                        }
                    });
                    if (checkConnection() == true) {
                        $("#loading img").show();
                        clearInterval(checkConnectionProgressBar);
                        app.updateContent();
                        return false;
                    }                    
                }, 3000);
                
                return false;
                contentReady = false;
            }            
        }
        
        // get the timestamp
        if (checkConnection() == true) {
            app.log("Cheking timestamp...")
            var request = new XMLHttpRequest();
            request.open("GET", appUrl + "inc/app/lastupdate", false);            
            request.onreadystatechange = function() {                
                if (request.readyState == 4) {
                    if (request.status == 200 || request.status == 0) {
                        currentUpdateTimeStamp = request.responseText;
                        app.log("Got timestamp = " + currentUpdateTimeStamp);
                    }
                    if (request.status == 404) {
                        // handle 404 errors?
                        app.log("error (404) checking of the timestamp");
                        return;
                    }
                } 
            }            
            request.send();            
        }
        
        if (currentUpdateTimeStamp != lastUpdated) {
            app.log("content was updated at " + lastUpdated + ", current TS is " + currentUpdateTimeStamp);
            if (checkConnection()) {
                app.log("we have Internet, start update...");
                contentReady = false;
            }
        } else {
            app.log("content was not changed, we can read it from the disk cache");
        }
        
        //contentReady = false;
        
        if (contentReady == false) {
            app.log("downloading app content...");
            $("#loading").show();            

            var request = new XMLHttpRequest();
            request.open("GET", appUrl + "inc/app/content.html", true);
            
            request.onprogress = function(e) {
                $("#progress").html( bytesToSize(e.loaded) + " loaded...");
            }

            request.onreadystatechange = function() {
                //app.log("Ready state: "+request.readyState+" // status: "+request.status+" Status text: "+request.statusText);
                if (request.readyState == 4) {
                    if (request.statusText == "") {
                        app.log("broken download of app content");
                        $("#progress").html("Error downloading content. Please try again.");
                        return false;
                    }
                    if (request.status == 200 || request.status == 0) {
                        $("#loading").hide();
                        app.log("done!");
                        $("#appContent").html(request.responseText);
                        contentReady = true;
                        app.localStorageWriter("appContent", request.responseText);
                        window.localStorage.setItem("lastUpdated", currentUpdateTimeStamp);
                        
                        // check if language is set
                        appLang = window.localStorage.getItem("appLang");
                        app.log("appLang -> " + appLang);
                        if (appLang == null) {
                            app.goToPage("#menuLanguage");
                            $("header").hide();
                        } else {
                            var home = "menu";
                            if (appLang != "HU") {
                                home = home + appLang;
                            }
                            app.goToPage("#"+home);
                            $("header").hide();
                        }
                            
                        app.initUrls();                    
                    }
                    if (request.status == 404) {
                        // handle 404 errors?
                        app.log("error (404) loading of app content");
                        return false;
                    }
                } 
            }            
            
            request.send();
        } else {
            app.readAppContent("appContent");
        }
    },
    
    goToPage: function(toPage) {
        // get type of page
        if (toPage == "#") {
            return;
        }
        
        if (toPage.indexOf("#") == 0) {
            app.log("page type internal");
            if (toPage == "#?lastScreen") {
                app.log("page type last screen " + app.getLastScreen());
                toPage = app.getLastScreen();
            }
            if ($(toPage).attr("id") == undefined) {
                return;
            }
        }
        
        if (toPage.indexOf("/") == 0) {
            app.log("page type external url " + toPage);
            // check if page is already loaded.
            if ( document.getElementById( app.getPageID(toPage) ) == undefined ) {
                app.log("start loading of " + appUrl + toPage);

                var request = new XMLHttpRequest();
                request.open("GET", appUrl + toPage, false);
                request.onreadystatechange = function(){
                    if (request.readyState == 4) {
                        if (request.status == 200 || request.status == 0) {
                            app.log("done loading of " + appUrl + toPage);
                            
                            $("#wrapper").append(request.responseText);                            
                            $("#wrapper .page:last").attr("id", app.getPageID(toPage) );
                            
                            toPage = "#" + $("#wrapper .page:last").attr("id");                            
                            app.initUrls();
                        }
                        if (request.status == 404) {
                            // handle 404 errors?
                            app.log("error (404) loading of " + appUrl + toPage);
                            return;
                        }
                    } 
                }
                request.send();                
            } else {
                app.log("page " + app.getPageID(toPage) + " already loaded");
                toPage = "#" + app.getPageID(toPage);
            }            
        }
        
        if (toPage.indexOf("http://") == 0) {
            window.open(toPage, '_system');
            return;
        }
        
        var fromPage = "#" + $("#wrapper .page.current").attr("id");
        if( $(toPage).hasClass("current") || toPage === fromPage) { 
            return;
        };
        
        app.log("go to from " + fromPage + " > " + toPage);
        
        $("#wrapper").scrollTop(0);
        $(toPage).scrollTop(0);
        
        $("header").hide();
        if ($(toPage).attr("navigation") == "1") {
            $("header").show(); 
        } 
        
        $(toPage).addClass("current fade in").one("webkitAnimationEnd", function(){
            $(fromPage).removeClass("current fade out");
            $(toPage).removeClass("fade in");            
        });
        $(fromPage).addClass("fade out");
        
        if ((toPage != "#connectionError") || (toPage != "#cover") || (toPage != "#?lastScreen")) {
            screenHistory.push(toPage);
            app.log(screenHistory);
        }
        
        $(fromPage).removeClass("current"); 
        $(toPage).addClass("current");  
    },
    
    getPageID: function(url) {
        url = url.replace(/\./g,'');
        url = url.replace(/\//g,'');
        url = url.replace(/\?/g,'');
        url = url.replace(/\&/g,'');
        return url;  
    },

    getLastScreen: function() {
        return screenHistory[screenHistory.length-2];
    },
    
    localStorageWriter: function(storageName, data) {
        window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
		window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function (fs) {
			appPath = fs.root.fullPath;
            var filePath = fs.root.fullPath + storageName;
            
            app.log("app FS Url = " +  fs.root.toURL());
            
            fs.root.getFile(filePath, {create: true, exclusive: false}, function (fileEntry) {                
                fileEntry.createWriter(function (writer) {
                    writer.onwriteend = function(evt) {
                        app.log("contents of " + filePath + " written");
                    };
                    writer.write(data);
                    app.log(storageName + " data length = " + data.length);                    
                }, function (error) {
                    app.log("Writer error: " + error);
                });
            }, function (error) {
                app.log("getFile error = " + error);
            });
            
		}, function (error) {
			app.log("requestFileSystem error: " + error);
		});
    },

    readAppContent: function(storageName) {
        $("#loading").show();    
        window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
		window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function (fs) {
			appPath = fs.root.fullPath;
            var filePath = fs.root.fullPath + storageName;
            
            app.log("app FS Url = " +  fs.root.toURL());            
            
            fs.root.getFile(filePath, null, function (fileEntry) {
                fileEntry.file(function (file) {                
                    var reader = new FileReader();
                    reader.onloadend = function(evt) {
                        app.log("done loading of app content");                   
                        $("#appContent").html(evt.target.result);
                        contentReady = true;
                        $("#loading").hide();
                        
                        // check if lanuage is set
                        appLang = window.localStorage.getItem("appLang");
                        app.log("appLang -> " + appLang);
                        if (appLang == null) {                            
                            app.goToPage("#menuLanguage");
                            $("header").hide();
                        } else {
                            var home = "menu";
                            if (appLang != "HU") {
                                home = home + appLang;
                            }
                            app.goToPage("#"+home);
                            $("header").hide();
                        }
                            
                        app.initUrls();
                    };
                    reader.readAsText(file);
                    app.log("Start reading app content...");
                }, function (error) {
                    app.log("fileEntry error: " + error);
                });
            }, function (error) {
                app.log("getFile error = " + error);
            });
		}, function (error) {
			app.log("requestFileSystem error: " + error);
		});
    },    
    
    // log messages
    log: function(msg) {
        if (debug) {
            console.log(msg);
        }
    } 
};

app.initialize();

$(window).ready(function() {    
    if (emulate) {
        app.log("browser emulation ON");
        app.receivedEvent('deviceready');
        appInit();
    }
    
    $("#menuClick").click(function(e){
        e.preventDefault();
        appLang = window.localStorage.getItem("appLang");
        var home = "menu";
        if (appLang != "HU") {
            home = home + appLang;
        }
        app.goToPage("#"+home);
    });    
    
    /*window.addEventListener("statusTap", function() {
        $("#wrapper").scrollTop(0);
        return false;
    });*/
});

function appInit() {
    app.updateContent();
    
    // check connection if neccesary
    /*if (emulate == false) {
        // on startup
        if (connectionRequired == true) {
            if (checkConnection() == false) {
                app.goToPage("#connectionError");
                connectionLost = true;
            }
        }
        
        // periodically
        setInterval(function() {
            if (connectionRequired == true) {
                //app.log("connection ... " + checkConnection());
                if(checkConnection() == false) {
                    app.goToPage("#connectionError");
                    connectionLost = true;
                }
                if(checkConnection() == true) {
                    if (connectionLost == true) {
                        app.goToPage(app.getLastScreen());
                    }
                    connectionLost = false;                    
                }
            }
        }, 500);
    }*/
    
    $( '.swipebox' ).swipebox();    
    
    app.log( "appInit OK" );
};

// CHECK internet connection
function checkConnection() {
    var networkState = navigator.connection.type;

    if (networkState == Connection.UNKNOWN || networkState == Connection.NONE) {
        return false;   
    } else {
        return true;    
    }
};

function bytesToSize(bytes) {
   var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
   if (bytes == 0) return '0 Byte';
   var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
   return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
};

/*
SELECT DATE_FORMAT(box_hir.lastModify, '%d%m%Y@%H%i') AS lastUpdate
FROM itworx.box_hir
INNER JOIN itworx.box_teaser ON box_teaser.TABLE_ID = box_hir.teaserID 
WHERE 
	box_teaser.csoportID = 732
	OR box_teaser.csoportID = 733
	OR box_teaser.csoportID = 734
	OR box_teaser.csoportID = 735
ORDER BY lastModify DESC
LIMIT 1;
*/
