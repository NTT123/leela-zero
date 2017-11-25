var putMove = function(move) {
    if (move == "pass") { 
        var p = new GOBAN.Point(0, 0);
        controller.onLast();
        controller.onViewClick(p);
        return ;
    }
    var x = move.charCodeAt(0) - "A".charCodeAt(0) + 1;
    if (x >= "J".charCodeAt(0) - "A".charCodeAt(0) + 1) x = x - 1;
    var y = parseInt(move.substring(1,3));
    var p = new GOBAN.Point(x, y);
    controller.onLast();
    controller.onViewClick(p);
};