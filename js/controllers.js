"use strict";
var squeezefox = angular.module('Squeezefox', ['ngAnimate'])
.config( [
    '$compileProvider',
    function( $compileProvider )
    {   
        $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|ftp|mailto|app):/);
    }
]);

/*
 * Test if input-value is valid port number (code from angularJS website)
 */
squeezefox.directive('portnumber', function() {
  return {
    require: 'ngModel',
    link: function(scope, elm, attrs, ctrl) {
      ctrl.$parsers.unshift(function(viewValue) {
        if (viewValue > 0 && viewValue < 65536) {
          // it is valid
          ctrl.$setValidity('portnumber', true);
          return viewValue;
        } else {
          // it is invalid, return undefined (no model update)
          ctrl.$setValidity('portnumber', false);
          return undefined;
        }
      });
    }
  };
});

squeezefox.controller('WindowCtrl', ['$scope', function ($scope) {
    
    $scope.players = [];
    $scope.selectedPlayer = { playerid: '', name: ''};
    /*
     * {playerid: "00:04:20:2b:39:ec", name: ''}; //XXX make dynamic
     */
    $scope.current_window = "play";
    $scope.hidden = false;
    $scope.server = { 
        addr: '', 
        port: '',
        retries: 0 // unused atm
    };
    localforage.getItem('server').then(function (cachedServer) {
        if (typeof cachedServer != 'undefined') {
            $scope.server = cachedServer;
        }
    });
    
    localforage.getItem('players').then(function (cachedPlayers) {
        $scope.players = cachedPlayers || [];
    })
    .then(function(){
        localforage.getItem('selectedPlayer', function(cachedSelectedPlayer) {
            /*
             * this is because the <select> tag will only remember the selection if ng-model is member of the array in ng-options (comparison by reference)
             * so we have to search the equal reference by eg playerid
             */
            for (var i = 0; i < $scope.players.length; i++) {
                if ($scope.players[i].playerid == cachedSelectedPlayer.playerid) {
                    $scope.selectedPlayer = $scope.players[i];
                    return;
                }
            }
        });
    });
    
    $scope.playlist = {current: 0, list: []};
    $scope.active   = false;
    $scope.power    = 0;
    $scope.playing  = false;
    $scope.shuffle  = 0;
    $scope.volume   = 0;
    
    $scope.cssVolbarVisible = false;
    
    $scope.JSONRPC = function JSONRPC(payload, callback) {
        var xhr = new XMLHttpRequest({mozSystem: true});
        xhr.open("POST", "http://"+$scope.server.addr+':'+$scope.server.port+"/jsonrpc.js");
        xhr.responseType = "json";
        xhr.send(JSON.stringify(payload));
        xhr.onload = function() {
            localforage.setItem("server", $scope.server);
            localforage.setItem("selectedPlayer", $scope.selectedPlayer);
            $scope.active = true;
            if ($scope.server.retries > 0) {
                $scope.server.retries = 0;
            }
            if (callback) { callback(this); }
        };
        xhr.onerror = function (e) {
            // XXX general error handling? provide another callback?
            $scope.server.retries++;
            utils.status.show('Connection problems');
            //console.log(e);
        };
    };
        
    /*
     * wrapper to JSONRPC. do a slim request on the current set playerid
     * params is a list, eg: ["play", ""]
     */
    $scope.queryPlayer = function (params, callback, playerid) {
        playerid = typeof playerid !== 'undefined' ? playerid : $scope.selectedPlayer.playerid;
        $scope.JSONRPC({"id":1,"method":"slim.request","params":[playerid, params]}, callback);
    }
    /*
     * do a query with empty playerid
     */
    $scope.queryServer = function (params, callback) {
        $scope.JSONRPC({"id":1,"method":"slim.request","params":["", params]}, callback);
    }
    
    $scope.play = function play() { // toggle
        $scope.queryPlayer(["play", ""]);
        //$scope.getStatus();
    };

    $scope.playPause = function playPause() { // toggle
        var newplaying = $scope.playing ? "1" : "0";
        $scope.playing = !$scope.playing;
        $scope.queryPlayer(["pause",newplaying]);
        //$scope.getStatus();
    };
    
    $scope.backward = function backward() {
        $scope.queryPlayer(["button","jump_rew"]);
        //$scope.getStatus();
    };
    
    $scope.forward = function forward() {
        $scope.queryPlayer(["button","jump_fwd"]);
        //$scope.getStatus();
    };
    
    $scope.toggleShuffle = function toggleShuffle() {
        // 0 = disabled, 1 = per song, 2 = per album (unused)
        var newshuffle = $scope.shuffle == "0" ? "1" : "0";
        $scope.shuffle = newshuffle;
        $scope.queryPlayer(["playlist","shuffle", newshuffle]);
    }

    $scope.powerToggle = function powerToggle() {
        var newpower = $scope.power ? "0" : "1";
        $scope.power = newpower;
        $scope.queryPlayer(["power", newpower]);
        //$scope.getStatus();
    };
    
    $scope.powerOn = function powerOn() {
        $scope.queryPlayer(["power","1"]);
        //$scope.getStatus();
    };
    
    $scope.volumeUp = function volup() {
        $scope.queryPlayer(["mixer","volume", "+2.5"]);
    };
    
    $scope.volumeDown = function voldown() {
        $scope.queryPlayer(["mixer","volume", "-2.5"]);
    };
    
    $scope.getVolume = function getVolume() {
        $scope.queryPlayer(['mixer','volume','?'], function(xhr){ 
            // XXX see issue #24. volumebar not compatible with all players.
            if (typeof xhr.response.result.mixer != 'undefined') {
                $scope.volume = xhr.response.result.mixer.volume; 
            }
            else {
                $scope.volume = 0;
            }
        });
    };
    /*
     * send volume change to server
     * Instead of using ng-click to push state changes to the server, it is suggested to create services and overload their save prototype http://plnkr.co/edit/urCRofoJKiPkEtuHAvPF?p=preview 
     */
    $scope.postVolume = function () {
        $scope.queryPlayer(['mixer','volume',$scope.volume]);
    };
    $scope.toggleMute = function toggleMute() {
        $scope.volume *= -1;
        $scope.queryPlayer(['mixer','muting','toggle']);
    };

    $scope.changeWindow = function changeWindow(name) {
        if (['play', 'music', 'favorites', 'settings'].indexOf(name) !== -1) {
            $scope.current_window = name;
        }
    }
    $scope.windowTitle = function(t) {
        function capitalize(s) {
            return s.substr(0,1).toUpperCase() + s.substr(1);
        }
        switch (t) {
            case "play":
                return "Now playing"
            break;
            case "music":
                return "Search";
            break;
            default:
                return capitalize(t);
        }
    }

    // CSS functions XXX rewrite with ng-show
    $scope.CSS_Enabled = function() {
        $scope.active = true;
    }; 

    // unused? -- obama
    $scope.CSS_Power = function() {
        return $scope.power ? "brightness" : "lower-brightness";
    } 

    $scope.CSS_window = function CSS_window(name) {
        var sb = document.getElementById("sidebar");
        var scope = angular.element(sb).scope();
        return (name == $scope.current_window) ? "" : "hiddenwindow"
    }
    
    // show/hide additional info in music search
    // close function is in NestedWindow controller..
    $scope.openArtistInfo = function() {
        document.querySelector('#artistinfo').classList.remove('right');
        document.querySelector('#artistinfo').classList.add('current');
        document.querySelector('[data-position="current"]').classList.remove('current');
        document.querySelector('[data-position="current"]').classList.add('left');
    }
    
    // moved trackdialog here, because i use it in the "nested window" too
    $scope.trackDialog = function trackDialog(item) {
        if ('title' in item) {
            item.track = item.title;
        }
        document.querySelector('#trackdialog').classList.remove('fade-out');
        document.querySelector('#trackdialog').classList.add('fade-in');
        $scope.dialogItem = item;
        $scope.showTrackDialog = true;
        
    }
    
    $scope.trackDialogClose = function() {
        document.querySelector('#trackdialog').classList.remove('fade-in');
        document.querySelector('#trackdialog').classList.add('fade-out');
        $scope.showTrackDialog = false;
    }
    
    $scope.prettyDuration = function prettyDuration(total) {
        function pad(d) {
            if (d < 10) { return '0'+d }
            return d
        }
        if (total == 0) { return; }
        var m = parseInt(total%3600 / 60),
            s = parseInt(total % 60);
        if (total < 3600) {
            return "("+m+":"+pad(s)+")";
        }
        else {
            var h = parseInt(total / 3600);
            return "("+h+":"+pad(m)+":"+pad(s)+")";
        }
    }
    
/*<div id="window-music"></div>
    <div id="window-favorites"></div>
    <div id="window-settings"></div>*/
    
}]);

squeezefox.controller('PlayerStatusCtrl', ['$scope', '$interval', function ($scope, $interval) {
    // defaults
    var lastUpdate       = 0;
    $scope.playerTitle   = "";
    $scope.currentArtist = "";
    $scope.currentTitle  = "";
    $scope.artworkURL    = "img/cover-missing.png";
    $scope.showPlaylist  = false;

    // Update Status
    $scope.getStatus = function getStatus() {
        //XXX replace 50 with max(50,playlistsize)
        if ($scope.$parent.hidden || typeof $scope.server.addr == 'undefined' || typeof $scope.server.port == 'undefined') {
             /* skips XHR when app is minimized, this is set
              * outside of angular with the page visibility api.
              * (see bottom of this file)
             */
            return;
        }
        $scope.queryPlayer(["status","-", 50, "tags:gABbehldiqtyrSuojcKLNJ"], function(xhr) {
            //xhr.response.result.mode (play, stop, pause)
            var rs = xhr.response.result;
            $scope.playerTitle                  = rs.current_title;
            $scope.$parent.playing              = (rs.mode == "play");
            $scope.$parent.active               = true;
            $scope.$parent.power                = rs.power;
            $scope.$parent.shuffle              = rs['playlist shuffle'];
            $scope.repeat                       = rs['playlist repeat'];
            $scope.$parent.playlist.list        = rs.playlist_loop;
            $scope.$parent.playlist.current     = rs.playlist_cur_index;
            var currentlyPlaying;
            for (var entry of $scope.$parent.playlist.list) {
                if (entry['playlist index'] == $scope.$parent.playlist.current) {
                    var currentlyPlaying = entry;
                    $scope.currentArtist = currentlyPlaying.artist;
                    $scope.currentTitle = currentlyPlaying.title;
                }
            }
            if ('remoteMeta' in rs) {
                var rm = rs.remoteMeta; //$scope.playlist.list[$scope.playlist.current];
                $scope.artworkURL = rm.artwork_url;
            }
            else if (rs.playlist_loop[rs.playlist_cur_index].coverart == "1") {
                $scope.artworkURL = "http://"+$scope.server.addr+':'+$scope.server.port+"/music/"+rs.playlist_loop[rs.playlist_cur_index].coverid+"/cover_300x300";
            }
            else {
                $scope.artworkURL = "img/cover-missing.png";
            }
            lastUpdate = Date.now();
        });
    }
    $scope.refresher = undefined;
    if (typeof $scope.refresher == "undefined") {
        $scope.getStatus();
        $scope.refresher = $interval(function() { $scope.getStatus(); }, 10000);
    }

    $scope.transitionToggle = function transitionToggle() {
        $scope.showPlaylist = $scope.showPlaylist ? false : true;
    }
    $scope.CSS_transition = function CSS_transition() {
        return $scope.showPlaylist ? "performtransition" : "";
    }

    // 
    $scope.playItem = function playItem(index) {
        //XXX update playlists and display?
        $scope.queryPlayer(["playlist","index",index,""]);
            
    }
    
}]);

squeezefox.controller('MusicSearchCtrl', ['$scope', function ($scope) {
    $scope.searchterm      = "";
    $scope.searchres       = { 'artist': [], 'album': [], 'track': [] };
    $scope.trackdetails    = {};
    $scope.$parent.showTrackDialog = false;
    $scope.$parent.dialogItem      = {};
    $scope.noresults       = { 'track': false, 'artist': false, 'album': false };
    $scope.searchprogress  = { 'track': false, 'album': false }; // artist is returned by "search" aswell. (though behavior seems different.. eg. a "artists" query for "d" will also return "Diverse Interpreten" while "search" wont.. but the search doesnt work anyways like expected. 
    $scope.cssHideRes      = { 'track': false, 'artist': false, 'album': false };
        
    // XXX many duplicate code, refactor somehow?
    $scope.search = function search(term) {
        $scope.searchprogress = { 'track': true, 'album': true };
        $scope.cssHideRes     = { 'track': false, 'artist': false, 'album': false };
        $scope.searchres      = { 'artist': [], 'album': [], 'track': [] };
               
        /* search albums independently, because this query will return also artist, year, cover
         * while "search" will only return album title (and we'd need another XX queries to fill in the details..)
        */
        $scope.queryServer(["albums", "0", "20", "search:"+term, "tags:layj"], function(xhr) {
            $scope.searchprogress.album = false; // XXX when xhr fails, progress will not be reset! spins forever!
            var rs = xhr.response.result;
            var albums = [];
            if ('albums_loop' in rs) {
                albums = rs.albums_loop;
                $scope.noresults.album = false;
            }
            else {
                $scope.noresults.album = true;
            }
            $scope.searchres.album = albums;
        });
        $scope.queryServer(["search", "0","20","term:"+term], function(xhr) {
            $scope.searchprogress.track = false;
            var rs = xhr.response.result;
            
            var tracks = []
            if ('tracks_loop' in rs) {
                tracks = rs.tracks_loop; // array with objects that have track_id, track properties 
                $scope.noresults.track = false;
            }
            else {
                $scope.noresults.track = true;
            }
            $scope.searchres.track = tracks;
            
            var artists = [];
            if ('contributors_loop' in rs) {
                artists = rs.contributors_loop;
                $scope.noresults.artist = false;
            }
            else {
                $scope.noresults.artist = true;
            }
            $scope.searchres.artist = artists;
            
            // fill in details for track list (e.g. artist)
            for (var item of tracks) {
                $scope.queryServer(["songinfo", "0","11","track_id:"+item.track_id], function(xhr) {
                    var songinfo = xhr.response.result.songinfo_loop;
                    $scope.trackdetails[parseInt(songinfo[0].id)] = {
                        title: songinfo[1].title, 
                        artist: songinfo[2].artist
                    };
                    var x = $scope.trackdetails[parseInt(songinfo[0].id)];
                    var i = 3; // if coverid is not available index is shifted -.- the output format is very unuseful.
                    if (typeof songinfo[3].coverid != 'undefined') {
                        x.coverid  = songinfo[3].coverid;
                        i++;
                    }
                    x.duration = songinfo[i++].duration,
                    x.album_id = songinfo[i++].album_id,
                    x.album    = songinfo[i].album,
                    x.coverurl = "http://"+$scope.server.addr+':'+$scope.server.port+"/music/"+x.coverid+"/cover_150x150_o"
                });
                    
            }
        });
    }
    // open nested window with tracks belonging to artist/album
    $scope.searchTracksByArtist = function(item) {
        $scope.nestedWindow.list = [];
        $scope.nestedWindow.title = item.contributor;
        $scope.nestedWindow.type = 'artist';
        $scope.nestedWindow.searchprogress = true;
        $scope.queryServer(["titles", "0","20","artist_id:"+item.contributor_id, "tags:dcl"], function(xhr) {
            $scope.nestedWindow.searchprogress = false; //XXX spin forever if xhr fails..
            if ('titles_loop' in xhr.response.result) {
                $scope.nestedWindow.list = xhr.response.result.titles_loop;
            }
            
        });
        $scope.openArtistInfo();
    }
    $scope.searchTracksByAlbum = function(item) {
        $scope.nestedWindow.list = [];
        $scope.nestedWindow.title = item.artist;
        $scope.nestedWindow.subtitle = item.album+' ('+item.year+')'; // not nice.
        $scope.nestedWindow.type = 'album';
        $scope.nestedWindow.img = 'http://'+$scope.server.addr+':'+$scope.server.port+'/music/'+item.artwork_track_id+'/cover_150x150';
        $scope.nestedWindow.searchprogress = true;
        $scope.queryServer(["titles", "0","20","album_id:"+item.id, "tags:dcl"], function(xhr) {
            $scope.nestedWindow.searchprogress = false; //XXX spin forever if xhr fails..
            if ('titles_loop' in xhr.response.result) {
                $scope.nestedWindow.list = xhr.response.result.titles_loop;
            }
        });
        $scope.openArtistInfo();
    }
    
    $scope.$parent.addItem = function addItem(item) { // add to queue
        $scope.trackDialogClose();
        $scope.queryPlayer(["playlist","addtracks","track.titlesearch="+(item.track ? item.track : item.title)]); // what if 2 tracks same name? add contributor.namesearch= property? API = fail..
    }
    $scope.$parent.playItem = function playItem(item) { // play now
        $scope.trackDialogClose();
        //$scope.queryPlayer(["playlist","loadtracks","track.titlesearch="+item.track])
        var plen = $scope.$parent.playlist.list.length;
        $scope.addItem(item); // strange there is no easier api call for this. (or is there?) also this is not 100% safe, eg when a track ends before moving is done?
        $scope.queryPlayer(["playlist","move", plen, 0]);
        $scope.queryPlayer(["playlist","index", 0]);
    }
}]);

squeezefox.controller('NestedWndCtrl', ['$scope', function ($scope) {
    
    /* XXX this is dependant on MusicWindowCtrl :( but to make the buildingblocks slidein "nested window" work, i had to change 
     * the HTML structure in such a way that a new controller was needed. im offline now, maybe read up angular docs later to fix 
     * this.
     */
    
    // the nestedWindow can contain tracks by artist or album (like the gaia music player)
    $scope.$parent.nestedWindow    = { 
        'title': '', 
        'subtitle': '', 
        'type': '', 
        'img': 'img/cover-missing.png', 
        'list':[],
        'searchprogress' : false
    };
    
    $scope.closeArtistInfo = function() {
        document.querySelector('#artistinfo').classList.remove('current');
        document.querySelector('#artistinfo').classList.add('right');
        document.querySelector('[data-position="current"]').classList.remove('left');
        document.querySelector('[data-position="current"]').classList.add('current');
    }
    
}]);

squeezefox.controller('FavoritesCtrl', ['$scope', function ($scope) {
    $scope.favorites = []
    localforage.getItem("favorites", function (cachedFavorites) {
        $scope.favorites = cachedFavorites || [];
    });
    var triedfavorites = false;
    if (triedfavorites == false) {
        if ($scope.selectedPlayer.playerid !== "") {
            triedfavorites = true;
            $scope.queryServer(["favorites","items","","9999"], function(xhr) {
                $scope.favorites = xhr.response.result.loop_loop;
                localforage.setItem("favorites", xhr.response.result.loop_loop);
            });
        }
    }
    $scope.playFavorite = function playFavorite(id) {
        $scope.queryServer(["favorites","playlist","play","item_id:"+id]); 
    }

    $scope.playDeezer = function() {
        var x = new XMLHttpRequest();
        x.open("GET",
        "http://192.168.235.2:9000/plugins/deezer/index.html?action=playall&index=4cd7c293.3.0.1&player=00%3A04%3A20%3A2b%3A39%3Aec&sess=&start=&_dc=1403809424200"
        );
        x.send();

    }
}]);

squeezefox.controller('SettingsCtrl', ['$scope', function ($scope) {
   
    /*     {
            "model" : "baby",
            "connected" : 1,
            "displaytype" : "none",
            "seq_no" : "297",
            "ip" : "192.168.235.180:54444",
            "power" : 0,
            "uuid" : "3e08aeb1e28940bfc8e73028939025f8",
            "name" : "Küchenradio",
            "isplayer" : 1,
            "canpoweroff" : 1,
            "playerid" : "00:04:20:2b:39:ec"
         }, */



    $scope.tryServer = function tryServer() {
        $scope.queryServer(["serverstatus",0,999], function(xhr) {
            $scope.$parent.active = true; // errback and feedback.            
            $scope.$parent.players = xhr.response.result.players_loop;
            localforage.setItem("players", xhr.response.result.players_loop);
        });
    }
}]);

angular.element(document).ready(function() {
    document.addEventListener("visibilitychange", function() {
        // used to limit getStatus XHR
        angular.element(document.body).scope().hidden = document.hidden;
    }, false);
        
    // fire a first getStatus asap: 
    // -- rather not because localforage might not have loaded the server data yet
    //angular.element(document.querySelector("#window-play")).scope().getStatus
});
