(function(w, d, undefined) {

	"use strict";

	var init = function() {
        load.init();
        nav.init();
        header.init();
        pageposition.init();
        lazy.init();
    };

    d.addEventListener('DOMContentLoaded', init);
    w.addEventListener('load', init);

}(window, window.document));