; var pageposition = (function(w, d, undefined) {

    "use strict";

    var init = function() {
        var st = window.pageYOffset || document.body.scrollTop || document.documentElement.scrollTop,
        windowHeight = window.innerHeight,
        body = document.body,
        html = document.documentElement,
        height = Math.max( body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight ),
        procent = -100 * (st / (windowHeight - height));

        document.getElementById("pageposition").style.width = procent + "vw";
        window.addEventListener("scroll", function() {
            var st = window.pageYOffset || document.body.scrollTop || document.documentElement.scrollTop,
            windowHeight = window.innerHeight,
            body = document.body,
            html = document.documentElement,
            height = Math.max( body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight ),
            procent = -100 * (st / (windowHeight - height));

            document.getElementById("pageposition").style.width = procent + "vw";
        }, false)
    };

    d.addEventListener('load', init);

    return {
        init:init
    };

}(window, window.document));