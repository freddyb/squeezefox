function SqueezeBoxControl(ip){
    var ip = ip;
    var host = "http://"+ip+':9000/';
    var intervalcallbacks = [];
    var interval;
    function setupInterval() {
        interval = setInterval(function updateStatus() {
            // do status shit :D
            var xhr = new XMLHttpRequest();
            /**
                < X-Player: 00:04:20:2b:39:ec
                < X-Playerindex: 21
                < X-Playermode: stop
                < X-Playername: K�chenradio
                < X-Playerrepeat: 0
                < X-Playershuffle: 0
                < X-Playersleep: 0
                < X-Playertime: 78.5485384674072
                < X-Playertitle: Everything Has Changed - William Fitzsimmons
                < X-Playertrack: deezer://61378543.mp3
                < X-Playertracks: 168
                < X-Playervolume: 60
                < X-Time-To-Serve: 0.0271048545837402
            */
            xhr.open("GET", host+"/status.txt");
            xhr.send();
            xhr.onload = function() {
                this.playing = (xhr.getResponseHeader("X-Playermode") == "stop") ? false : true; // what abot "pause"?
                this.shuffle = xhr.getResponseHeader("X-Playershuffle");
                this.playertitle = xhr.getResponseHeader("X-playertitle");
            }
        }, 5000);
    }
    this.changeHost = function changeHost(newip, callback) {
        ip = newip;
        // check new ip!!1
    }

    
} 
/*

server status:
 curl -v http://192.168.235.2:9000/jsonrpc.js -d '{"id":1,"method":"slim.request","params":["",["serverstatus",0,999]]}'
    {"params":["",["serverstatus","0","999"]],"method":"slim.request","id":1,"result":{"other player count":0,"info total albums":138,"player count":2,"version":"7.7.3","players_loop":[{"seq_no":"271","playerid":"00:04:20:2b:39:ec","displaytype":"none","connected":1,"ip":"192.168.235.180:55774","model":"baby","name":"Küchenradio","uuid":"3e08aeb1e28940bfc8e73028939025f8","isplayer":1,"canpoweroff":1,"power":0},{"seq_no":0,"playerid":"192.168.235.181","connected":0,"ip":"192.168.235.181:39404","model":"http","name":"VLC aus 192.168.235.181","uuid":null,"isplayer":0,"canpoweroff":0,"power":1}],"uuid":"11c60eb1-9e03-4579-8bc9-3e98d42b73e7","sn player count":0,"info total artists":70,"info total songs":1500,"lastscan":"1402312751","info total genres":40}}

-> playerstatus for each
curl -v http://192.168.235.2:9000/jsonrpc.js -d ' {"id":1,"method":"slim.request","params":["00:04:20:2b:39:ec",["status","-",1,"tags:gABbehldiqtyrSuoKLN"]]}'
    {"params":["00:04:20:2b:39:ec",["status","-",1,"tags:gABbehldiqtyrSuoKLN"]],"method":"slim.request","id":1,"result":{"seq_no":"271","mixer volume":60,"player_name":"Küchenradio","playlist_tracks":1,"player_connected":1,"time":0,"mode":"stop","playlist_timestamp":1403848372.75108,"remote":1,"rate":1,"power":0,"playlist mode":"off","playlist repeat":0,"playlist_cur_index":"0","playlist_loop":[{"playlist index":0,"id":"-213927784","title":"Morgenecho Mit Judith Schulte-Loh","artist":"Sie hören","duration":"0","year":"0","bitrate":"128kb/s CBR","url":"http://gffstream.ic.llnwd.net/stream/gffstream_w19b","type":"MP3 Radio","remote_title":"WDR5 - Hören erleben. 90.3 (Information)"}],"signalstrength":45,"remoteMeta":{"id":"-213927784","title":"Morgenecho Mit Judith Schulte-Loh","artist":"Sie hören","duration":"0","year":"0","bitrate":"128kb/s CBR","url":"http://gffstream.ic.llnwd.net/stream/gffstream_w19b","type":"MP3 Radio","remote_title":"WDR5 - Hören erleben. 90.3 (Information)"},"playlist shuffle":0,"curren* Connection #0 to host 192.168.235.2 left intact
t_title":"WDR 5, © Westdeutscher Rundfunk Köln","player_ip":"192.168.235.180:55774"}}

* jump forward
 {"id":1,"method":"slim.request","params":["67:1d:9b:bb:a2:85",["button","jump_fwd"]]}



 
 * fetzfetz: (space lord :<)
curl 'http://192.168.235.2:9000/plugins/deezer/index.html?action=playall&index=4cd7c293.3.0.1&player=00%3A04%3A20%3A2b%3A39%3Aec&sess=&start=&_dc=1403809424200'


wdr:

http://192.168.235.2:9000/plugins/Favorites/index.html?action=play&index=0&player=00%3A04%3A20%3A2b%3A39%3Aec&_dc=1403809597456


*/
