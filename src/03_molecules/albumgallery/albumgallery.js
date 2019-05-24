; var lazy = (function(w, d, undefined) {

    "use strict";
    var currentforce = null, prev = null, next = null;
    var init = function() {
        $('.lazy').Lazy({
            bind: "event",
            scrollDirection: 'vertical',
            effect: 'fadeIn',
            visibleOnly: true,
            afterLoad: function(element) {
                element.parent().addClass("loaded");
            },
        }).parent().css("padding-top", "0")

        $("img.lazy").unbind('click').bind("click", function() {
            currentforce = $(this).attr('src');
            viewforce(currentforce);
        });

        $("#viewforce").unbind('click').bind("click", function(e) {
            if (e.target !== this) {
                return;
            };
            $("#viewforce").css("display", "none;")
        });

        $("#next").unbind('click').bind("click", function(e) {
            currentforce = $("#viewforce img.viewforceimage").attr("src");
            var next = $('img.lazy[src*="' + currentforce + '"]').parent('.albumItem').attr('data-next');
            if (next == '') { return true;}
            viewforce(next);
        });

        $("#prev").unbind('click').bind("click", function(e) {
            currentforce = $("#viewforce img.viewforceimage").attr("src");
            var prev = $('img.lazy[src*="' + currentforce + '"]').parent('.albumItem').attr('data-prev');
            if (prev == '') { return true;}
            viewforce(prev);
        });

        $("body").unbind('keydown').bind("keydown", function(e) {
            if(e.keyCode == 37 || e.keyCode == 39) { // left
                currentforce = $("#viewforce img.viewforceimage").attr("src");
                if(e.keyCode == 37) { // left
                    var prev = $('img.lazy[src*="' + currentforce + '"]').parent('.albumItem').attr('data-prev');
                    if (prev == '') { return true;}
                    viewforce(prev);
                }
                else if(e.keyCode == 39) { // right
                    var next = $('img.lazy[src*="' + currentforce + '"]').parent('.albumItem').attr('data-next');
                    if (next == '') { return true;}
                    viewforce(next);
                };
            }
        });
    };

    var viewforce = function(src){
        $("#viewforce").css("display", "block")
        $("#viewforce img.viewforceimage").attr("src", src);

        $('html, body').animate({
            scrollTop: $('img.lazy[src*="' + src + '"]').offset().top
        }, 100);
    }


    d.addEventListener('load', init);

    return {
        init:init
    };

}(window, window.document));