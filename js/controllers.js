"use strict";
var squeezefox = angular.module('Squeezefox', ['ngAnimate'])
.config([
    '$compileProvider',
    function( $compileProvider )
    {
        $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|ftp|mailto|app):/);
    }
]);

squeezefox.controller('WindowCtrl', ['$scope', function ($scope) {

    $scope.players = [];
    $scope.selectedPlayer = {playerid: "",
                             name: ""};

    $scope.current_window = "play";
    // FxOS >2.2 can use volup/voldown hardware buttons:
    $scope.showVolumeBar = true; //XXX bug !(/Mobile.*Firefox\/36/).test(navigator.userAgent);
    $scope.hidden = false;
    $scope.server = { addr: '', port: '', retries: 0 };
    localforage.getItem('server').then(function (cachedServer) {
        if (typeof cachedServer != 'undefined' && cachedServer != null) {
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

    $scope.JSONRPC = function JSONRPC(payload, callback) {
        var xhr = new XMLHttpRequest({mozSystem: true});
        xhr.open("POST", "http://"+$scope.server.addr+':'+$scope.server.port+"/jsonrpc.js");
        xhr.responseType = "json";
        xhr.send(JSON.stringify(payload));
        xhr.onload = function() {
            localforage.setItem("server", $scope.server);
            localforage.setItem("selectedPlayer", $scope.selectedPlayer);
            $scope.active = true;
            // count retries for error handling? yagni?
            if ($scope.server.retries > 0) {
                $scope.server.retries = 0;
            }
            if (callback) { callback(this); }
        };
        xhr.onerror = function (e) {
            // XXX general error handling? provide another callback?
            $scope.server.retries++;
            utils.status.show('Connection problems');
        };
    };

    /*
    * wrapper to JSONRPC. do a slim request on the current set playerid
    * params is a list, eg: ["play", ""]
    */
    $scope.queryPlayer = function (params, callback, playerid) {
        playerid = typeof playerid !== 'undefined' ? playerid : $scope.selectedPlayer.playerid;
        $scope.JSONRPC({"id":1,"method":"slim.request","params":[playerid, params]}, callback);
    };
    /*
    * do a query with empty playerid
    */
    $scope.queryServer = function (params, callback) {
        $scope.JSONRPC({"id":1,"method":"slim.request","params":["", params]}, callback);
    };

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
    };


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


    $scope.changeWindow = function changeWindow(name) {
        if (['play', 'music', 'favorites', 'settings'].indexOf(name) !== -1) {
            $scope.current_window = name;
        }
    };
    $scope.windowTitle = function(t) {
        function capitalize(s) {
            return s.substr(0,1).toUpperCase() + s.substr(1);
        }
        switch (t) {
            case "play":
                return "Now playing";
            break;
            default:
                return capitalize(t);
        }
    };

    // CSS functions XXX rewrite with ng-show
    $scope.CSS_Enabled = function() {
        $scope.active = true;
    };
    $scope.CSS_Playing = function() {
        return $scope.playing ? 'media-pause' : 'media-play';
    };
    $scope.CSS_Shuffle = function() {
        return $scope.shuffle ? 'media-shuffleon' : 'media-shuffleoff';
    };

    $scope.CSS_Power = function() {
        return $scope.power ? "brightness" : "lower-brightness";

    };

    $scope.CSS_window = function CSS_window(name) {
        var sb = document.getElementById("sidebar");
        var scope = angular.element(sb).scope();
        return (name == $scope.current_window) ? "" : "hiddenwindow"
    };


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
        if ($scope.$parent.hidden ||
            typeof $scope.server == 'undefined' ||
            $scope.server == null ||
            typeof $scope.server.addr == 'undefined' ||
            typeof $scope.server.port == 'undefined' ||
            $scope.server.addr == '' ||
            $scope.server.port == ''
            ) {
             /* skips XHR when app is minimized, this is set
              * outside of angular with the page visibility api.
              * (see bottom of this file)
             */
            return;
        }
        $scope.queryPlayer(["status","-", 50, "tags:gABbehldiqtyrSuojcKLNJ"], function(xhr) {
            //xhr.response.result.mode (play, stop, pause)
            var rs = xhr.response.result;
            $scope.playerTitle              = rs.current_title;
            $scope.$parent.playing          = (rs.mode == "play");
            $scope.$parent.active           = true;
            $scope.$parent.power            = rs.power;
            $scope.$parent.shuffle          = rs['playlist shuffle'];
            $scope.repeat                   = rs['playlist repeat'];
            $scope.$parent.playlist.list    = rs.playlist_loop;
            $scope.$parent.playlist.current = rs.playlist_cur_index;
            var currentlyPlaying;
            for (var entry of $scope.$parent.playlist.list) {
                if (entry['playlist index'] == $scope.$parent.playlist.current) {
                    currentlyPlaying = entry;
                    $scope.currentArtist = currentlyPlaying.artist;
                    $scope.currentTitle = currentlyPlaying.title;
                }
            }
            if ('remoteMeta' in rs) {
                var rm = rs.remoteMeta; //$scope.playlist.list[$scope.playlist.current];
                $scope.artworkURL = rm.artwork_url;
            }
            else if (rs.playlist_loop[0].coverart == "1") {
                $scope.artworkURL = "http://"+$scope.server.addr+':'+$scope.server.port+"/music/"+rs.playlist_loop[0].coverid+"/cover_300x300";
            }
            else {
                $scope.artworkURL = "img/cover-missing.png";
            }
            lastUpdate = Date.now();
        });
    };
    $scope.refresher = undefined;
    if (typeof $scope.refresher == "undefined") {
        $scope.getStatus();
        $scope.refresher = $interval(function() { $scope.getStatus(); }, 5000);
    }

    $scope.transitionToggle = function transitionToggle() {
        $scope.showPlaylist = $scope.showPlaylist ? false : true;
    };
    $scope.CSS_transition = function CSS_transition() {
        return $scope.showPlaylist ? "performtransition" : "";
    };

    //
    $scope.playItem = function playItem(index) {
        //XXX update playlists and display?
        $scope.queryPlayer(["playlist","index",index,""]);
    };
    $scope.prettyDuration = function prettyDuration(total) {
        function pad(d) {
            if (d < 10) { return '0'+d }
            return d
        }
        if (total == 0) { return; }
            var m = parseInt(total%3600 / 60);
            var s = Math.floor(total % 60);
        if (total < 3600) {
            return "("+m+":"+pad(s)+")";
        }
        else {
            var h = parseInt(total / 3600);
            return "("+h+":"+pad(m)+":"+pad(s)+")";
        }
    }
}]);
squeezefox.controller('MusicSearchCtrl', ['$scope', function ($scope) {
    $scope.searchterm = "";
    $scope.searchresults = [];
    $scope.searchdetails = {};
    $scope.showTrackDialog = false;
    $scope.dialogItem = {};
    $scope.noresults = { 'track': false };
    $scope.searchprogress = { 'track': false };

    $scope.search = function search(term) {
        $scope.searchprogress = { 'track': true };
        $scope.queryServer(["search", "0","20","term:"+term], function(xhr) {
            $scope.searchprogress.track = false;
            var tracks = [];
            if ('tracks_loop' in xhr.response.result) {
                $scope.noresults.track = false;
                tracks = xhr.response.result.tracks_loop; // array with objects that have track_id, track properties
            }
            else {
                $scope.noresults.track = true;
            }
            $scope.searchresults = tracks;
            // fill in details for list (e.g. artist)
            for (var item of tracks) {
                $scope.queryServer(["songinfo", "0","11","track_id:"+item.track_id], function(xhr) {
                    var songinfo = xhr.response.result.songinfo_loop;
                    $scope.searchdetails[parseInt(songinfo[0].id)] = {
                        title: songinfo[1].title, artist: songinfo[2].artist,
                        coverid: songinfo[3].coverid, duration: songinfo[4].duration,
                        album_id: songinfo[5].album_id,
                        album: songinfo[5].album,
                        coverurl: "http://"+$scope.server.addr+':'+$scope.server.port+"/music/"+songinfo[3].coverid+"/cover_150x150_o" };
                });
            }
        });
    };
    $scope.trackDialog = function trackDialog(item) {
      $scope.dialogItem = item;
      $scope.showTrackDialog = true;
    };
    $scope.addItem = function addItem(item) { // add to queue
        $scope.showTrackDialog=false;
        $scope.queryPlayer(["playlist","addtracks","track.titlesearch="+(item.track ? item.track : item.title)]); // what if 2 tracks same name? add contributor.namesearch= property? API = fail..
    };
    $scope.playItem = function playItem(item) { // play now
        $scope.showTrackDialog=false;
        var plen = $scope.$parent.playlist.list.length;
        /* strange there is no easier api call for this. (or is there?)
         * also this is not 100% safe, eg when a track ends before moving is done?
         * XXX should play now mean: put it at pos 0 or pos 1? please test this
         */
        $scope.addItem(item);
        $scope.queryPlayer(["playlist","move", plen, 0]);
        $scope.queryPlayer(["playlist","index", 0]);
    }
}]);

squeezefox.controller('FavoritesCtrl', ['$scope', function ($scope) {
    $scope.favorites = [];
    localforage.getItem("favorites", function (cachedFavorites) {
        $scope.favorites = cachedFavorites || [];
    });
    var triedfavorites = false;
    if (triedfavorites == false) {
        if ($scope.selectedPlayer.playerid !== "") {
            triedfavorites = true;
            $scope.freddysbox = ("00:04:20:2b:39:ec" == $scope.selectedPlayer.playerid);
            $scope.JSONRPC({"id":1,"method":"slim.request","params": [$scope.selectedPlayer.playerid, ["favorites","items","","9999"]]}, function(xhr) {
                $scope.favorites = xhr.response.result.loop_loop;
                localforage.setItem("favorites", xhr.response.result.loop_loop);
            });
        }
    }
    $scope.loadFavorites = function() {
      if ($scope.selectedPlayer.playerid !== "") {
          triedfavorites = true;
          $scope.freddysbox = ("00:04:20:2b:39:ec" == $scope.selectedPlayer.playerid);
          $scope.JSONRPC({"id":1,"method":"slim.request","params": [$scope.selectedPlayer.playerid, ["favorites","items","","9999"]]}, function(xhr) {
              $scope.favorites = xhr.response.result.loop_loop;
              localforage.setItem("favorites", xhr.response.result.loop_loop);
          });
      }
    };
    $scope.playFavorite = function playFavorite(id) {
        $scope.JSONRPC({"id":1,"method":"slim.request","params": [$scope.selectedPlayer.playerid, ["favorites","playlist","play","item_id:"+id]]});
    };

    // show only on my squeezebox, until we have found out how this feature works and if there's API support:
    $scope.freddysbox = false;

    $scope.playDeezer = function() {
        var x = new XMLHttpRequest();
        x.open("GET",
        "http://"+$scope.server.addr+':'+$scope.server.port+ "/plugins/deezer/index.html?action=playall&index=4cd7c293.3.0.1&player="+ encodeURIComponent($scope.selectedPlayer.playerid) +"&sess=&start=&_dc=1403809424200"
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
            $scope.players = xhr.response.result.players_loop;
            localforage.setItem("players", xhr.response.result.players_loop);
        });
    }
}]);

angular.element(document).ready(function() {
    document.addEventListener("visibilitychange", function() {
        // used to limit getStatus XHR
        angular.element(document.body).scope().hidden = document.hidden;
    }, false);

    window.addEventListener("keydown", function(evt) {
      if (evt.key == 'VolumeDown') {
        angular.element(document.body).scope().volumeDown();
        evt.preventDefault();
      } else if (evt.key == 'VolumeUp') {
        angular.element(document.body).scope().volumeUp();
        evt.preventDefault();
      }
    });
    // fire a first getStatus asap:
    //angular.element(document.querySelector("#window-play")).scope().getStatus
});
