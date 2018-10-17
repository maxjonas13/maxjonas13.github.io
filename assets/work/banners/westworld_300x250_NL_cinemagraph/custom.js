var creative = (function (window, document, undefined) {
    init = function () {
        creative.debug = false;
        creative.debug && console.log('CREATIVE: Initialized');

        canvas = document.getElementById("canvas");
        banner = document.getElementById('banner');
        background = document.getElementById('background');

        creative.width = banner.offsetWidth;
        creative.backgroundwidth = background.offsetWidth;


        build();
    },

    build = function () {
        creative.debug && console.log('CREATIVE: Building');
        play();
    },

    lightining = function(){
        tllightning = new TimelineMax()
        .set('#forground_light, #background_light', {opacity:0 })

        .addLabel('framelightning')
        .to('#forground_light, #background_light', 0.1, {opacity:1 }, "framelightning")
        .to('#forground_light, #background_light', 0.1, {opacity:0 }, "framelightning+=0.2")
        .to('#forground_light, #background_light', 0.1, {opacity:1 }, "framelightning+=0.4")
        .to('#forground_light, #background_light', 0.1, {opacity:0 }, "framelightning+=0.7")
        .to('#forground_light, #background_light', 0.1, {opacity:1 }, "framelightning+=0.8")
        .to('#forground_light, #background_light', 0.1, {opacity:0 }, "framelightning+=0.9")
    },

    play = function () {
        creative.debug && console.log('CREATIVE: Playing');

        tlight = new TimelineMax()
        .set('#forground_light, #background_light', {opacity:0 })
        .addLabel('frame1', 3).add(lightining, "frame1")
        .addLabel('frame2', 7).add(lightining, "frame2")
        .addLabel('frame3', 14).add(lightining, "frame3")
        .duration(15);

        tl = new TimelineMax()
        .to('#preload', 0, {opacity:0, zIndex:-1})

        .set("#forground, #forground_light", {transformOrigin: "50% 60%"})
        .addLabel('frame1')
        .from("#background, #background_light", 15, {right: -creative.backgroundwidth + creative.width}, "frame1")
        .from("#forground, #forground_light", 15, {css:{scale:1.05}}, "frame1")
        .duration(15);

        tlCta = new TimelineMax({repeat: -1, repeatDelay: 3})
        .to(".cta", 0.25, {scale:1.2, ease: Back.easeOut}, '+=3')
        .to(".cta", 0.5, {scale:1, ease: Elastic.easeOut});

    }

    return { init: init }
}(window, window.document))
