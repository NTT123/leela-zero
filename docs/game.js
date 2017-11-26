var bestNetworkHash = null;
var myGame = {};
var isPlaying = false;
var numberPlayedGames = 0;

var initGame = function () {
    console.log("Initializng game...");
    myGame['resignation'] = false;
    myGame['blackToMove'] = true;
    myGame['time'] = 'time_settings 0 1 0';
    myGame['blackResigned'] = false;
    myGame['passes'] = 0;
    myGame['moveNum'] = 0;
};

var startGame = function () {
    Module.sendcmd(myGame['time']);
    console.log("Infinite thinking time");
};

var moveGame = function () {
    var cmd = "genmove w";
    if (myGame['blackToMove']) {
        cmd = "genmove b";
    }
    Module.sendcmd(cmd);
    myGame['moveNum'] = myGame['moveNum'] + 1;
};

var readMove = function (txt) {
    if (txt[0] == '=' && txt.length > 2) {
        var move = txt.split(" ")[1];
        if (move == "pass") {
            myGame['passes'] = myGame['passes'] + 1;
            putMove(move);
            
        } else if (move == "resign") {
            myGame['resignation'] = myGame['blacktoMove'];
        } else {
            myGame['passes'] = 0;
            putMove(move);
        }
        nextMove();
    }
};

var nextMove = function () {
    if (myGame['resignation'] || myGame['passes'] > 1 || myGame['moveNum'] > 19 * 19 * 2) {
        console.log("END GAME!");
        writeSgf();
    } else {
        myGame['blackToMove'] = !myGame['blackToMove'];
        moveGame();
    }
};

var getScore = function () {
    Module.sendcmd("final_score");
};


var writeSgf = function () {
    Module.sendcmd("printsgf " + bestNetworkHash + ".sgf");
};


var dumpTraining = function () {
    Module.sendcmd("dump_training " + bestNetworkHash + ".txt");
};

var gameQuit = function () {
    Module.sendcmd("quit");
};

var sendGoogle = function () {
    var i = 0;
    for (i = 0; i < 1e6; i++)
        if (filearray[i] == 0) break;

    var game = new TextDecoder("utf-8").decode(filearray.slice(0, i));
    var mygame = game.replace(/hello/i, bestNetworkHash.substring(0,8));
    console.log("Saving the game.");
    console.log(mygame);

    var ifrm = document.createElement("frame");
    ifrm.setAttribute("src", encodeURI("https://docs.google.com/forms/d/e/1FAIpQLSeMsbKnSJoNXe6i4qpPvuA8HwJsiPCULMn3LqrmKeDjH4juKg/formResponse?entry.1371348489=") + encodeURIComponent(mygame));

    document.body.appendChild(ifrm);
    ifrm.onload= function() { 
        ncount = parseInt(readCookie("NGAME"));

        ncount = ncount + 1;
        eraseCookie("NGAME");
        createCookie("NGAME", String(ncount), 365*10);
        setTimeout(function() {  location.reload(); }, 2000);
    };
};