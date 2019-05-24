/*!
 * jQuery & Zepto Lazy - v1.7.10
 * http://jquery.eisbehr.de/lazy/
 *
 * Copyright 2012 - 2018, Daniel 'Eisbehr' Kern
 *
 * Dual licensed under the MIT and GPL-2.0 licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl-2.0.html
 *
 * $("img.lazy").lazy();
 */

;(function(window, undefined) {
    "use strict";

    // noinspection JSUnresolvedVariable
    /**
     * library instance - here and not in construct to be shorter in minimization
     * @return void
     */
    var $ = window.jQuery || window.Zepto,

    /**
     * unique plugin instance id counter
     * @type {number}
     */
    lazyInstanceId = 0,

    /**
     * helper to register window load for jQuery 3
     * @type {boolean}
     */    
    windowLoaded = false;

    /**
     * make lazy available to jquery - and make it a bit more case-insensitive :)
     * @access public
     * @type {function}
     * @param {object} settings
     * @return {LazyPlugin}
     */
    $.fn.Lazy = $.fn.lazy = function(settings) {
        return new LazyPlugin(this, settings);
    };

    /**
     * helper to add plugins to lazy prototype configuration
     * @access public
     * @type {function}
     * @param {string|Array} names
     * @param {string|Array|function} [elements]
     * @param {function} loader
     * @return void
     */
    $.Lazy = $.lazy = function(names, elements, loader) {
        // make second parameter optional
        if ($.isFunction(elements)) {
            loader = elements;
            elements = [];
        }

        // exit here if parameter is not a callable function
        if (!$.isFunction(loader)) {
            return;
        }

        // make parameters an array of names to be sure
        names = $.isArray(names) ? names : [names];
        elements = $.isArray(elements) ? elements : [elements];

        var config = LazyPlugin.prototype.config,
            forced = config._f || (config._f = {});

        // add the loader plugin for every name
        for (var i = 0, l = names.length; i < l; i++) {
            if (config[names[i]] === undefined || $.isFunction(config[names[i]])) {
                config[names[i]] = loader;
            }
        }

        // add forced elements loader
        for (var c = 0, a = elements.length; c < a; c++) {
            forced[elements[c]] = names[0];
        }
    };

    /**
     * contains all logic and the whole element handling
     * is packed in a private function outside class to reduce memory usage, because it will not be created on every plugin instance
     * @access private
     * @type {function}
     * @param {LazyPlugin} instance
     * @param {object} config
     * @param {object|Array} items
     * @param {object} events
     * @param {string} namespace
     * @return void
     */
    function _executeLazy(instance, config, items, events, namespace) {
        /**
         * a helper to trigger the 'onFinishedAll' callback after all other events
         * @access private
         * @type {number}
         */
        var _awaitingAfterLoad = 0,

        /**
         * visible content width
         * @access private
         * @type {number}
         */
        _actualWidth = -1,

        /**
         * visible content height
         * @access private
         * @type {number}
         */
        _actualHeight = -1,

        /**
         * determine possibly detected high pixel density
         * @access private
         * @type {boolean}
         */
        _isRetinaDisplay = false, 

        /**
         * dictionary entry for better minimization
         * @access private
         * @type {string}
         */
        _afterLoad = 'afterLoad',

        /**
         * dictionary entry for better minimization
         * @access private
         * @type {string}
         */
        _load = 'load',

        /**
         * dictionary entry for better minimization
         * @access private
         * @type {string}
         */
        _error = 'error',

        /**
         * dictionary entry for better minimization
         * @access private
         * @type {string}
         */
        _img = 'img',

        /**
         * dictionary entry for better minimization
         * @access private
         * @type {string}
         */
        _src = 'src',

        /**
         * dictionary entry for better minimization
         * @access private
         * @type {string}
         */
        _srcset = 'srcset',

        /**
         * dictionary entry for better minimization
         * @access private
         * @type {string}
         */
        _sizes = 'sizes',

        /**
         * dictionary entry for better minimization
         * @access private
         * @type {string}
         */
        _backgroundImage = 'background-image';

        /**
         * initialize plugin
         * bind loading to events or set delay time to load all items at once
         * @access private
         * @return void
         */
        function _initialize() {
            // detect actual device pixel ratio
            // noinspection JSUnresolvedVariable
            _isRetinaDisplay = window.devicePixelRatio > 1;

            // prepare all initial items
            items = _prepareItems(items);

            // if delay time is set load all items at once after delay time
            if (config.delay >= 0) {
                setTimeout(function() {
                    _lazyLoadItems(true);
                }, config.delay);
            }

            // if no delay is set or combine usage is active bind events
            if (config.delay < 0 || config.combined) {
                // create unique event function
                events.e = _throttle(config.throttle, function(event) {
                    // reset detected window size on resize event
                    if (event.type === 'resize') {
                        _actualWidth = _actualHeight = -1;
                    }

                    // execute 'lazy magic'
                    _lazyLoadItems(event.all);
                });

                // create function to add new items to instance
                events.a = function(additionalItems) {
                    additionalItems = _prepareItems(additionalItems);
                    items.push.apply(items, additionalItems);
                };

                // create function to get all instance items left
                events.g = function() {
                    // filter loaded items before return in case internal filter was not running until now
                    return (items = $(items).filter(function() {
                        return !$(this).data(config.loadedName);
                    }));
                };

                // create function to force loading elements
                events.f = function(forcedItems) {
                    for (var i = 0; i < forcedItems.length; i++) {
                        // only handle item if available in current instance
                        // use a compare function, because Zepto can't handle object parameter for filter
                        // var item = items.filter(forcedItems[i]);
                        /* jshint loopfunc: true */
                        var item = items.filter(function() {
                            return this === forcedItems[i];
                        });

                        if (item.length) {
                            _lazyLoadItems(false, item);   
                        }
                    }
                };

                // load initial items
                _lazyLoadItems();

                // bind lazy load functions to scroll and resize event
                // noinspection JSUnresolvedVariable
                $(config.appendScroll).on('scroll.' + namespace + ' resize.' + namespace, events.e);
            }
        }

        /**
         * prepare items before handle them
         * @access private
         * @param {Array|object|jQuery} items
         * @return {Array|object|jQuery}
         */
        function _prepareItems(items) {
            // fetch used configurations before loops
            var defaultImage = config.defaultImage,
                placeholder = config.placeholder,
                imageBase = config.imageBase,
                srcsetAttribute = config.srcsetAttribute,
                loaderAttribute = config.loaderAttribute,
                forcedTags = config._f || {};

            // filter items and only add those who not handled yet and got needed attributes available
            items = $(items).filter(function() {
                var element = $(this),
                    tag = _getElementTagName(this);

                return !element.data(config.handledName) && 
                       (element.attr(config.attribute) || element.attr(srcsetAttribute) || element.attr(loaderAttribute) || forcedTags[tag] !== undefined);
            })

            // append plugin instance to all elements
            .data('plugin_' + config.name, instance);

            for (var i = 0, l = items.length; i < l; i++) {
                var element = $(items[i]),
                    tag = _getElementTagName(items[i]),
                    elementImageBase = element.attr(config.imageBaseAttribute) || imageBase;

                // generate and update source set if an image base is set
                if (tag === _img && elementImageBase && element.attr(srcsetAttribute)) {
                    element.attr(srcsetAttribute, _getCorrectedSrcSet(element.attr(srcsetAttribute), elementImageBase));
                }

                // add loader to forced element types
                if (forcedTags[tag] !== undefined && !element.attr(loaderAttribute)) {
                    element.attr(loaderAttribute, forcedTags[tag]);
                }

                // set default image on every element without source
                if (tag === _img && defaultImage && !element.attr(_src)) {
                    element.attr(_src, defaultImage);
                }

                // set placeholder on every element without background image
                else if (tag !== _img && placeholder && (!element.css(_backgroundImage) || element.css(_backgroundImage) === 'none')) {
                    element.css(_backgroundImage, "url('" + placeholder + "')");
                }
            }

            return items;
        }

        /**
         * the 'lazy magic' - check all items
         * @access private
         * @param {boolean} [allItems]
         * @param {object} [forced]
         * @return void
         */
        function _lazyLoadItems(allItems, forced) {
            // skip if no items where left
            if (!items.length) {
                // destroy instance if option is enabled
                if (config.autoDestroy) {
                    // noinspection JSUnresolvedFunction
                    instance.destroy();
                }

                return;
            }

            var elements = forced || items,
                loadTriggered = false,
                imageBase = config.imageBase || '',
                srcsetAttribute = config.srcsetAttribute,
                handledName = config.handledName;

            // loop all available items
            for (var i = 0; i < elements.length; i++) {
                // item is at least in loadable area
                if (allItems || forced || _isInLoadableArea(elements[i])) {
                    var element = $(elements[i]),
                        tag = _getElementTagName(elements[i]),
                        attribute = element.attr(config.attribute),
                        elementImageBase = element.attr(config.imageBaseAttribute) || imageBase,
                        customLoader = element.attr(config.loaderAttribute);

                        // is not already handled 
                    if (!element.data(handledName) &&
                        // and is visible or visibility doesn't matter
                        (!config.visibleOnly || element.is(':visible')) && (
                        // and image source or source set attribute is available
                        (attribute || element.attr(srcsetAttribute)) && (
                            // and is image tag where attribute is not equal source or source set
                            (tag === _img && (elementImageBase + attribute !== element.attr(_src) || element.attr(srcsetAttribute) !== element.attr(_srcset))) ||
                            // or is non image tag where attribute is not equal background
                            (tag !== _img && elementImageBase + attribute !== element.css(_backgroundImage))
                        ) ||
                        // or custom loader is available
                        customLoader))
                    {
                        // mark element always as handled as this point to prevent double handling
                        loadTriggered = true;
                        element.data(handledName, true);

                        // load item
                        _handleItem(element, tag, elementImageBase, customLoader);
                    }
                }
            }

            // when something was loaded remove them from remaining items
            if (loadTriggered) {
                items = $(items).filter(function() {
                    return !$(this).data(handledName);
                });
            }
        }

        /**
         * load the given element the lazy way
         * @access private
         * @param {object} element
         * @param {string} tag
         * @param {string} imageBase
         * @param {function} [customLoader]
         * @return void
         */
        function _handleItem(element, tag, imageBase, customLoader) {
            // increment count of items waiting for after load
            ++_awaitingAfterLoad;

            // extended error callback for correct 'onFinishedAll' handling
            var errorCallback = function() {
                _triggerCallback('onError', element);
                _reduceAwaiting();

                // prevent further callback calls
                errorCallback = $.noop;
            };

            // trigger function before loading image
            _triggerCallback('beforeLoad', element);

            // fetch all double used data here for better code minimization
            var srcAttribute = config.attribute,
                srcsetAttribute = config.srcsetAttribute,
                sizesAttribute = config.sizesAttribute,
                retinaAttribute = config.retinaAttribute,
                removeAttribute = config.removeAttribute,
                loadedName = config.loadedName,
                elementRetina = element.attr(retinaAttribute);

            // handle custom loader
            if (customLoader) {
                // on load callback
                var loadCallback = function() {
                    // remove attribute from element
                    if (removeAttribute) {
                        element.removeAttr(config.loaderAttribute);
                    }

                    // mark element as loaded
                    element.data(loadedName, true);

                    // call after load event
                    _triggerCallback(_afterLoad, element);

                    // remove item from waiting queue and possibly trigger finished event
                    // it's needed to be asynchronous to run after filter was in _lazyLoadItems
                    setTimeout(_reduceAwaiting, 1);

                    // prevent further callback calls
                    loadCallback = $.noop;
                };

                // bind error event to trigger callback and reduce waiting amount
                element.off(_error).one(_error, errorCallback)

                // bind after load callback to element
                .one(_load, loadCallback);

                // trigger custom loader and handle response
                if (!_triggerCallback(customLoader, element, function(response) {
                    if(response) {
                        element.off(_load);
                        loadCallback();
                    }
                    else {
                        element.off(_error);
                        errorCallback();
                    }
                })) {
                    element.trigger(_error);
                }
            }

            // handle images
            else {
                // create image object
                var imageObj = $(new Image());

                // bind error event to trigger callback and reduce waiting amount
                imageObj.one(_error, errorCallback)

                // bind after load callback to image
                .one(_load, function() {
                    // remove element from view
                    element.hide();

                    // set image back to element
                    // do it as single 'attr' calls, to be sure 'src' is set after 'srcset'
                    if (tag === _img) {
                        element.attr(_sizes, imageObj.attr(_sizes))
                               .attr(_srcset, imageObj.attr(_srcset))
                               .attr(_src, imageObj.attr(_src));
                    }
                    else {
                        element.css(_backgroundImage, "url('" + imageObj.attr(_src) + "')");
                    }

                    // bring it back with some effect!
                    element[config.effect](config.effectTime);

                    // remove attribute from element
                    if (removeAttribute) {
                        element.removeAttr(srcAttribute + ' ' + srcsetAttribute + ' ' + retinaAttribute + ' ' + config.imageBaseAttribute);

                        // only remove 'sizes' attribute, if it was a custom one
                        if (sizesAttribute !== _sizes) {
                            element.removeAttr(sizesAttribute);
                        }
                    }

                    // mark element as loaded
                    element.data(loadedName, true);

                    // call after load event
                    _triggerCallback(_afterLoad, element);

                    // cleanup image object
                    imageObj.remove();

                    // remove item from waiting queue and possibly trigger finished event
                    _reduceAwaiting();
                });

                // set sources
                // do it as single 'attr' calls, to be sure 'src' is set after 'srcset'
                var imageSrc = (_isRetinaDisplay && elementRetina ? elementRetina : element.attr(srcAttribute)) || '';
                imageObj.attr(_sizes, element.attr(sizesAttribute))
                        .attr(_srcset, element.attr(srcsetAttribute))
                        .attr(_src, imageSrc ? imageBase + imageSrc : null);

                // call after load even on cached image
                imageObj.complete && imageObj.trigger(_load); // jshint ignore : line
            }
        }

        /**
         * check if the given element is inside the current viewport or threshold
         * @access private
         * @param {object} element
         * @return {boolean}
         */
        function _isInLoadableArea(element) {
            var elementBound = element.getBoundingClientRect(),
                direction    = config.scrollDirection,
                threshold    = config.threshold,
                vertical     = // check if element is in loadable area from top
                               ((_getActualHeight() + threshold) > elementBound.top) &&
                               // check if element is even in loadable are from bottom
                               (-threshold < elementBound.bottom),
                horizontal   = // check if element is in loadable area from left
                               ((_getActualWidth() + threshold) > elementBound.left) &&
                               // check if element is even in loadable area from right
                               (-threshold < elementBound.right);

            if (direction === 'vertical') {
                return vertical;
            }
            else if (direction === 'horizontal') {
                return horizontal;
            }

            return vertical && horizontal;
        }

        /**
         * receive the current viewed width of the browser
         * @access private
         * @return {number}
         */
        function _getActualWidth() {
            return _actualWidth >= 0 ? _actualWidth : (_actualWidth = $(window).width());
        }

        /**
         * receive the current viewed height of the browser
         * @access private
         * @return {number}
         */
        function _getActualHeight() {
            return _actualHeight >= 0 ? _actualHeight : (_actualHeight = $(window).height());
        }

        /**
         * get lowercase tag name of an element
         * @access private
         * @param {object} element
         * @returns {string}
         */
        function _getElementTagName(element) {
            return element.tagName.toLowerCase();
        }

        /**
         * prepend image base to all srcset entries
         * @access private
         * @param {string} srcset
         * @param {string} imageBase
         * @returns {string}
         */
        function _getCorrectedSrcSet(srcset, imageBase) {
            if (imageBase) {
                // trim, remove unnecessary spaces and split entries
                var entries = srcset.split(',');
                srcset = '';

                for (var i = 0, l = entries.length; i < l; i++) {
                    srcset += imageBase + entries[i].trim() + (i !== l - 1 ? ',' : '');
                }
            }

            return srcset;
        }

        /**
         * helper function to throttle down event triggering
         * @access private
         * @param {number} delay
         * @param {function} callback
         * @return {function}
         */
        function _throttle(delay, callback) {
            var timeout,
                lastExecute = 0;

            return function(event, ignoreThrottle) {
                var elapsed = +new Date() - lastExecute;

                function run() {
                    lastExecute = +new Date();
                    // noinspection JSUnresolvedFunction
                    callback.call(instance, event);
                }

                timeout && clearTimeout(timeout); // jshint ignore : line

                if (elapsed > delay || !config.enableThrottle || ignoreThrottle) {
                    run();
                }
                else {
                    timeout = setTimeout(run, delay - elapsed);
                }
            };
        }

        /**
         * reduce count of awaiting elements to 'afterLoad' event and fire 'onFinishedAll' if reached zero
         * @access private
         * @return void
         */
        function _reduceAwaiting() {
            --_awaitingAfterLoad;

            // if no items were left trigger finished event
            if (!items.length && !_awaitingAfterLoad) {
                _triggerCallback('onFinishedAll');
            }
        }

        /**
         * single implementation to handle callbacks, pass element and set 'this' to current instance
         * @access private
         * @param {string|function} callback
         * @param {object} [element]
         * @param {*} [args]
         * @return {boolean}
         */
        function _triggerCallback(callback, element, args) {
            if ((callback = config[callback])) {
                // jQuery's internal '$(arguments).slice(1)' are causing problems at least on old iPads
                // below is shorthand of 'Array.prototype.slice.call(arguments, 1)'
                callback.apply(instance, [].slice.call(arguments, 1));
                return true;
            }

            return false;
        }

        // if event driven or window is already loaded don't wait for page loading
        if (config.bind === 'event' || windowLoaded) {
            _initialize();
        }

        // otherwise load initial items and start lazy after page load
        else {
            // noinspection JSUnresolvedVariable
            $(window).on(_load + '.' + namespace, _initialize);
        }  
    }

    /**
     * lazy plugin class constructor
     * @constructor
     * @access private
     * @param {object} elements
     * @param {object} settings
     * @return {object|LazyPlugin}
     */
    function LazyPlugin(elements, settings) {
        /**
         * this lazy plugin instance
         * @access private
         * @type {object|LazyPlugin|LazyPlugin.prototype}
         */
        var _instance = this,

        /**
         * this lazy plugin instance configuration
         * @access private
         * @type {object}
         */
        _config = $.extend({}, _instance.config, settings),

        /**
         * instance generated event executed on container scroll or resize
         * packed in an object to be referenceable and short named because properties will not be minified
         * @access private
         * @type {object}
         */
        _events = {},

        /**
         * unique namespace for instance related events
         * @access private
         * @type {string}
         */
        _namespace = _config.name + '-' + (++lazyInstanceId);

        // noinspection JSUndefinedPropertyAssignment
        /**
         * wrapper to get or set an entry from plugin instance configuration
         * much smaller on minify as direct access
         * @access public
         * @type {function}
         * @param {string} entryName
         * @param {*} [value]
         * @return {LazyPlugin|*}
         */
        _instance.config = function(entryName, value) {
            if (value === undefined) {
                return _config[entryName];
            }

            _config[entryName] = value;
            return _instance;
        };

        // noinspection JSUndefinedPropertyAssignment
        /**
         * add additional items to current instance
         * @access public
         * @param {Array|object|string} items
         * @return {LazyPlugin}
         */
        _instance.addItems = function(items) {
            _events.a && _events.a($.type(items) === 'string' ? $(items) : items); // jshint ignore : line
            return _instance;
        };

        // noinspection JSUndefinedPropertyAssignment
        /**
         * get all left items of this instance
         * @access public
         * @returns {object}
         */
        _instance.getItems = function() {
            return _events.g ? _events.g() : {};
        };

        // noinspection JSUndefinedPropertyAssignment
        /**
         * force lazy to load all items in loadable area right now
         * by default without throttle
         * @access public
         * @type {function}
         * @param {boolean} [useThrottle]
         * @return {LazyPlugin}
         */
        _instance.update = function(useThrottle) {
            _events.e && _events.e({}, !useThrottle); // jshint ignore : line
            return _instance;
        };

        // noinspection JSUndefinedPropertyAssignment
        /**
         * force element(s) to load directly, ignoring the viewport
         * @access public
         * @param {Array|object|string} items
         * @return {LazyPlugin}
         */
        _instance.force = function(items) {
            _events.f && _events.f($.type(items) === 'string' ? $(items) : items); // jshint ignore : line
            return _instance;
        };

        // noinspection JSUndefinedPropertyAssignment
        /**
         * force lazy to load all available items right now
         * this call ignores throttling
         * @access public
         * @type {function}
         * @return {LazyPlugin}
         */
        _instance.loadAll = function() {
            _events.e && _events.e({all: true}, true); // jshint ignore : line
            return _instance;
        };

        // noinspection JSUndefinedPropertyAssignment
        /**
         * destroy this plugin instance
         * @access public
         * @type {function}
         * @return undefined
         */
        _instance.destroy = function() {
            // unbind instance generated events
            // noinspection JSUnresolvedFunction, JSUnresolvedVariable
            $(_config.appendScroll).off('.' + _namespace, _events.e);
            // noinspection JSUnresolvedVariable
            $(window).off('.' + _namespace);

            // clear events
            _events = {};

            return undefined;
        };

        // start using lazy and return all elements to be chainable or instance for further use
        // noinspection JSUnresolvedVariable
        _executeLazy(_instance, _config, elements, _events, _namespace);
        return _config.chainable ? elements : _instance;
    }

    /**
     * settings and configuration data
     * @access public
     * @type {object|*}
     */
    LazyPlugin.prototype.config = {
        // general
        name               : 'lazy',
        chainable          : true,
        autoDestroy        : true,
        bind               : 'load',
        threshold          : 500,
        visibleOnly        : false,
        appendScroll       : window,
        scrollDirection    : 'both',
        imageBase          : null,
        defaultImage       : 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
        placeholder        : null,
        delay              : -1,
        combined           : false,

        // attributes
        attribute          : 'data-src',
        srcsetAttribute    : 'data-srcset',
        sizesAttribute     : 'data-sizes',
        retinaAttribute    : 'data-retina',
        loaderAttribute    : 'data-loader',
        imageBaseAttribute : 'data-imagebase',
        removeAttribute    : true,
        handledName        : 'handled',
        loadedName         : 'loaded',

        // effect
        effect             : 'show',
        effectTime         : 0,

        // throttle
        enableThrottle     : true,
        throttle           : 250,

        // callbacks
        beforeLoad         : undefined,
        afterLoad          : undefined,
        onError            : undefined,
        onFinishedAll      : undefined
    };

    // register window load event globally to prevent not loading elements
    // since jQuery 3.X ready state is fully async and may be executed after 'load' 
    $(window).on('load', function() {
        windowLoaded = true;
    });
})(window);
/*! jQuery & Zepto Lazy v1.7.10 - http://jquery.eisbehr.de/lazy - MIT&GPL-2.0 license - Copyright 2012-2018 Daniel 'Eisbehr' Kern */
!function(t,e){"use strict";function r(r,a,i,u,l){function f(){L=t.devicePixelRatio>1,i=c(i),a.delay>=0&&setTimeout(function(){s(!0)},a.delay),(a.delay<0||a.combined)&&(u.e=v(a.throttle,function(t){"resize"===t.type&&(w=B=-1),s(t.all)}),u.a=function(t){t=c(t),i.push.apply(i,t)},u.g=function(){return i=n(i).filter(function(){return!n(this).data(a.loadedName)})},u.f=function(t){for(var e=0;e<t.length;e++){var r=i.filter(function(){return this===t[e]});r.length&&s(!1,r)}},s(),n(a.appendScroll).on("scroll."+l+" resize."+l,u.e))}function c(t){var i=a.defaultImage,o=a.placeholder,u=a.imageBase,l=a.srcsetAttribute,f=a.loaderAttribute,c=a._f||{};t=n(t).filter(function(){var t=n(this),r=m(this);return!t.data(a.handledName)&&(t.attr(a.attribute)||t.attr(l)||t.attr(f)||c[r]!==e)}).data("plugin_"+a.name,r);for(var s=0,d=t.length;s<d;s++){var A=n(t[s]),g=m(t[s]),h=A.attr(a.imageBaseAttribute)||u;g===N&&h&&A.attr(l)&&A.attr(l,b(A.attr(l),h)),c[g]===e||A.attr(f)||A.attr(f,c[g]),g===N&&i&&!A.attr(E)?A.attr(E,i):g===N||!o||A.css(O)&&"none"!==A.css(O)||A.css(O,"url('"+o+"')")}return t}function s(t,e){if(!i.length)return void(a.autoDestroy&&r.destroy());for(var o=e||i,u=!1,l=a.imageBase||"",f=a.srcsetAttribute,c=a.handledName,s=0;s<o.length;s++)if(t||e||A(o[s])){var g=n(o[s]),h=m(o[s]),b=g.attr(a.attribute),v=g.attr(a.imageBaseAttribute)||l,p=g.attr(a.loaderAttribute);g.data(c)||a.visibleOnly&&!g.is(":visible")||!((b||g.attr(f))&&(h===N&&(v+b!==g.attr(E)||g.attr(f)!==g.attr(F))||h!==N&&v+b!==g.css(O))||p)||(u=!0,g.data(c,!0),d(g,h,v,p))}u&&(i=n(i).filter(function(){return!n(this).data(c)}))}function d(t,e,r,i){++z;var o=function(){y("onError",t),p(),o=n.noop};y("beforeLoad",t);var u=a.attribute,l=a.srcsetAttribute,f=a.sizesAttribute,c=a.retinaAttribute,s=a.removeAttribute,d=a.loadedName,A=t.attr(c);if(i){var g=function(){s&&t.removeAttr(a.loaderAttribute),t.data(d,!0),y(T,t),setTimeout(p,1),g=n.noop};t.off(I).one(I,o).one(D,g),y(i,t,function(e){e?(t.off(D),g()):(t.off(I),o())})||t.trigger(I)}else{var h=n(new Image);h.one(I,o).one(D,function(){t.hide(),e===N?t.attr(C,h.attr(C)).attr(F,h.attr(F)).attr(E,h.attr(E)):t.css(O,"url('"+h.attr(E)+"')"),t[a.effect](a.effectTime),s&&(t.removeAttr(u+" "+l+" "+c+" "+a.imageBaseAttribute),f!==C&&t.removeAttr(f)),t.data(d,!0),y(T,t),h.remove(),p()});var m=(L&&A?A:t.attr(u))||"";h.attr(C,t.attr(f)).attr(F,t.attr(l)).attr(E,m?r+m:null),h.complete&&h.trigger(D)}}function A(t){var e=t.getBoundingClientRect(),r=a.scrollDirection,n=a.threshold,i=h()+n>e.top&&-n<e.bottom,o=g()+n>e.left&&-n<e.right;return"vertical"===r?i:"horizontal"===r?o:i&&o}function g(){return w>=0?w:w=n(t).width()}function h(){return B>=0?B:B=n(t).height()}function m(t){return t.tagName.toLowerCase()}function b(t,e){if(e){var r=t.split(",");t="";for(var a=0,n=r.length;a<n;a++)t+=e+r[a].trim()+(a!==n-1?",":"")}return t}function v(t,e){var n,i=0;return function(o,u){function l(){i=+new Date,e.call(r,o)}var f=+new Date-i;n&&clearTimeout(n),f>t||!a.enableThrottle||u?l():n=setTimeout(l,t-f)}}function p(){--z,i.length||z||y("onFinishedAll")}function y(t,e,n){return!!(t=a[t])&&(t.apply(r,[].slice.call(arguments,1)),!0)}var z=0,w=-1,B=-1,L=!1,T="afterLoad",D="load",I="error",N="img",E="src",F="srcset",C="sizes",O="background-image";"event"===a.bind||o?f():n(t).on(D+"."+l,f)}function a(a,o){var u=this,l=n.extend({},u.config,o),f={},c=l.name+"-"+ ++i;return u.config=function(t,r){return r===e?l[t]:(l[t]=r,u)},u.addItems=function(t){return f.a&&f.a("string"===n.type(t)?n(t):t),u},u.getItems=function(){return f.g?f.g():{}},u.update=function(t){return f.e&&f.e({},!t),u},u.force=function(t){return f.f&&f.f("string"===n.type(t)?n(t):t),u},u.loadAll=function(){return f.e&&f.e({all:!0},!0),u},u.destroy=function(){return n(l.appendScroll).off("."+c,f.e),n(t).off("."+c),f={},e},r(u,l,a,f,c),l.chainable?a:u}var n=t.jQuery||t.Zepto,i=0,o=!1;n.fn.Lazy=n.fn.lazy=function(t){return new a(this,t)},n.Lazy=n.lazy=function(t,r,i){if(n.isFunction(r)&&(i=r,r=[]),n.isFunction(i)){t=n.isArray(t)?t:[t],r=n.isArray(r)?r:[r];for(var o=a.prototype.config,u=o._f||(o._f={}),l=0,f=t.length;l<f;l++)(o[t[l]]===e||n.isFunction(o[t[l]]))&&(o[t[l]]=i);for(var c=0,s=r.length;c<s;c++)u[r[c]]=t[0]}},a.prototype.config={name:"lazy",chainable:!0,autoDestroy:!0,bind:"load",threshold:500,visibleOnly:!1,appendScroll:t,scrollDirection:"both",imageBase:null,defaultImage:"data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==",placeholder:null,delay:-1,combined:!1,attribute:"data-src",srcsetAttribute:"data-srcset",sizesAttribute:"data-sizes",retinaAttribute:"data-retina",loaderAttribute:"data-loader",imageBaseAttribute:"data-imagebase",removeAttribute:!0,handledName:"handled",loadedName:"loaded",effect:"show",effectTime:0,enableThrottle:!0,throttle:250,beforeLoad:e,afterLoad:e,onError:e,onFinishedAll:e},n(t).on("load",function(){o=!0})}(window);
/*!
 * jQuery & Zepto Lazy - AJAX Plugin - v1.4
 * http://jquery.eisbehr.de/lazy/
 *
 * Copyright 2012 - 2018, Daniel 'Eisbehr' Kern
 *
 * Dual licensed under the MIT and GPL-2.0 licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl-2.0.html
 */
;(function($) {
    // load data by ajax request and pass them to elements inner html, like:
    // <div data-loader="ajax" data-src="url.html" data-method="post" data-type="html"></div>
    $.lazy('ajax', function(element, response) {
        ajaxRequest(this, element, response, element.attr('data-method'));
    });

    // load data by ajax get request and pass them to elements inner html, like:
    // <div data-loader="get" data-src="url.html" data-type="html"></div>
    $.lazy('get', function(element, response) {
        ajaxRequest(this, element, response, 'GET');
    });

    // load data by ajax post request and pass them to elements inner html, like:
    // <div data-loader="post" data-src="url.html" data-type="html"></div>
    $.lazy('post', function(element, response) {
        ajaxRequest(this, element, response, 'POST');
    });

    // load data by ajax put request and pass them to elements inner html, like:
    // <div data-loader="put" data-src="url.html" data-type="html"></div>
    $.lazy('put', function(element, response) {
        ajaxRequest(this, element, response, 'PUT');
    });

    /**
     * execute ajax request and handle response
     * @param {object} instance
     * @param {jQuery|object} element
     * @param {function} response
     * @param {string} [method]
     */
    function ajaxRequest(instance, element, response, method) {
        method = method ? method.toUpperCase() : 'GET';

        var data;
        if ((method === 'POST' || method === 'PUT') && instance.config('ajaxCreateData')) {
            data = instance.config('ajaxCreateData').apply(instance, [element]);
        }

        $.ajax({
            url: element.attr('data-src'),
            type: method === 'POST' || method === 'PUT' ? method : 'GET',
            data: data,
            dataType: element.attr('data-type') || 'html',

            /**
             * success callback
             * @access private
             * @param {*} content
             * @return {void}
             */
            success: function(content) {
                // set responded data to element's inner html
                element.html(content);

                // use response function for Zepto
                response(true);

                // remove attributes
                if (instance.config('removeAttribute')) {
                    element.removeAttr('data-src data-method data-type');
                }
            },

            /**
             * error callback
             * @access private
             * @return {void}
             */
            error: function() {
                // pass error state to lazy
                // use response function for Zepto
                response(false);
            }
        });
    }
})(window.jQuery || window.Zepto);

/*!
 * jQuery & Zepto Lazy - AV Plugin - v1.4
 * http://jquery.eisbehr.de/lazy/
 *
 * Copyright 2012 - 2018, Daniel 'Eisbehr' Kern
 *
 * Dual licensed under the MIT and GPL-2.0 licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl-2.0.html
 */
;(function($) {
    // loads audio and video tags including tracks by two ways, like:
    // <audio>
    //   <data-src src="audio.ogg" type="video/ogg"></data-src>
    //   <data-src src="audio.mp3" type="video/mp3"></data-src>
    // </audio>
    // <video data-poster="poster.jpg">
    //   <data-src src="video.ogv" type="video/ogv"></data-src>
    //   <data-src src="video.webm" type="video/webm"></data-src>
    //   <data-src src="video.mp4" type="video/mp4"></data-src>
    //   <data-track kind="captions" src="captions.vtt" srclang="en"></data-track>
    //   <data-track kind="descriptions" src="descriptions.vtt" srclang="en"></data-track>
    //   <data-track kind="subtitles" src="subtitles.vtt" srclang="de"></data-track>
    // </video>
    //
    // or:
    // <audio data-src="audio.ogg|video/ogg,video.mp3|video/mp3"></video>
    // <video data-poster="poster.jpg" data-src="video.ogv|video/ogv,video.webm|video/webm,video.mp4|video/mp4">
    //   <data-track kind="captions" src="captions.vtt" srclang="en"></data-track>
    //   <data-track kind="descriptions" src="descriptions.vtt" srclang="en"></data-track>
    //   <data-track kind="subtitles" src="subtitles.vtt" srclang="de"></data-track>
    // </video>
    $.lazy(['av', 'audio', 'video'], ['audio', 'video'], function(element, response) {
        var elementTagName = element[0].tagName.toLowerCase();

        if (elementTagName === 'audio' || elementTagName === 'video') {
            var srcAttr = 'data-src',
                sources = element.find(srcAttr),
                tracks = element.find('data-track'),
                sourcesInError = 0,

            // create on error callback for sources
            onError = function() {
                if (++sourcesInError === sources.length) {
                    response(false);
                }
            },

            // create callback to handle a source or track entry
            handleSource = function() {
                var source = $(this),
                    type = source[0].tagName.toLowerCase(),
                    attributes = source.prop('attributes'),
                    target = $(type === srcAttr ? '<source>' : '<track>');

                if (type === srcAttr) {
                    target.one('error', onError);
                }

                $.each(attributes, function(index, attribute) {
                    target.attr(attribute.name, attribute.value);
                });

                source.replaceWith(target);
            };

            // create event for successfull load
            element.one('loadedmetadata', function() {
                response(true);
            })

            // remove default callbacks to ignore loading poster image
            .off('load error')

            // load poster image
            .attr('poster', element.attr('data-poster'));

            // load by child tags
            if (sources.length) {
                sources.each(handleSource);
            }

            // load by attribute
            else if (element.attr(srcAttr)) {
                // split for every entry by comma
                $.each(element.attr(srcAttr).split(','), function(index, value) {
                    // split again for file and file type
                    var parts = value.split('|');

                    // create a source entry
                    element.append($('<source>')
                           .one('error', onError)
                           .attr({src: parts[0].trim(), type: parts[1].trim()}));
                });

                // remove now obsolete attribute
                if (this.config('removeAttribute')) {
                    element.removeAttr(srcAttr);
                }
            }

            else {
                // pass error state
                // use response function for Zepto
                response(false);
            }

            // load optional tracks
            if (tracks.length) {
                tracks.each(handleSource);
            }
        }

        else {
            // pass error state
            // use response function for Zepto
            response(false);
        }
    });
})(window.jQuery || window.Zepto);

/*!
 * jQuery & Zepto Lazy - iFrame Plugin - v1.5
 * http://jquery.eisbehr.de/lazy/
 *
 * Copyright 2012 - 2018, Daniel 'Eisbehr' Kern
 *
 * Dual licensed under the MIT and GPL-2.0 licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl-2.0.html
 */
;(function($) {
    // load iframe content, like:
    // <iframe data-src="iframe.html"></iframe>
    //
    // enable content error check with:
    // <iframe data-src="iframe.html" data-error-detect="true"></iframe>
    $.lazy(['frame', 'iframe'], 'iframe', function(element, response) {
        var instance = this;

        if (element[0].tagName.toLowerCase() === 'iframe') {
            var srcAttr = 'data-src',
                errorDetectAttr = 'data-error-detect',
                errorDetect = element.attr(errorDetectAttr);

            // default way, just replace the 'src' attribute
            if (errorDetect !== 'true' && errorDetect !== '1') {
                // set iframe source
                element.attr('src', element.attr(srcAttr));

                // remove attributes
                if (instance.config('removeAttribute')) {
                    element.removeAttr(srcAttr + ' ' + errorDetectAttr);
                }
            }

            // extended way, even check if the document is available
            else {
                $.ajax({
                    url: element.attr(srcAttr),
                    dataType: 'html',
                    crossDomain: true,
                    xhrFields: {withCredentials: true},

                    /**
                     * success callback
                     * @access private
                     * @param {*} content
                     * @return {void}
                     */
                    success: function(content) {
                        // set responded data to element's inner html
                        element.html(content)

                        // change iframe src
                        .attr('src', element.attr(srcAttr));

                        // remove attributes
                        if (instance.config('removeAttribute')) {
                            element.removeAttr(srcAttr + ' ' + errorDetectAttr);
                        }
                    },

                    /**
                     * error callback
                     * @access private
                     * @return {void}
                     */
                    error: function() {
                        // pass error state to lazy
                        // use response function for Zepto
                        response(false);
                    }
                });
            }
        }

        else {
            // pass error state to lazy
            // use response function for Zepto
            response(false);
        }
    });
})(window.jQuery || window.Zepto);

/*!
 * jQuery & Zepto Lazy - NOOP Plugin - v1.2
 * http://jquery.eisbehr.de/lazy/
 *
 * Copyright 2012 - 2018, Daniel 'Eisbehr' Kern
 *
 * Dual licensed under the MIT and GPL-2.0 licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl-2.0.html
 */
;(function($) {
    // will do nothing, used to disable elements or for development
    // use like:
    // <div data-loader="noop"></div>

    // does not do anything, just a 'no-operation' helper ;)
    $.lazy('noop', function() {});

    // does nothing, but response a successfull loading
    $.lazy('noop-success', function(element, response) {
        // use response function for Zepto
        response(true);
    });

    // does nothing, but response a failed loading
    $.lazy('noop-error', function(element, response) {
        // use response function for Zepto
        response(false);
    });
})(window.jQuery || window.Zepto);

/*!
 * jQuery & Zepto Lazy - Picture Plugin - v1.3
 * http://jquery.eisbehr.de/lazy/
 *
 * Copyright 2012 - 2018, Daniel 'Eisbehr' Kern
 *
 * Dual licensed under the MIT and GPL-2.0 licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl-2.0.html
 */
;(function($) {
    var srcAttr = 'data-src',
        srcsetAttr = 'data-srcset',
        mediaAttr = 'data-media',
        sizesAttr = 'data-sizes',
        typeAttr = 'data-type';

    // loads picture elements like:
    // <picture>
    //   <data-src srcset="1x.jpg 1x, 2x.jpg 2x, 3x.jpg 3x" media="(min-width: 600px)" type="image/jpeg"></data-src>
    //   <data-src srcset="1x.jpg 1x, 2x.jpg 2x, 3x.jpg 3x" media="(min-width: 400px)" type="image/jpeg"></data-src>
    //   <data-img src="default.jpg" >
    // </picture>
    //
    // or:
    // <picture data-src="default.jpg">
    //   <data-src srcset="1x.jpg 1x, 2x.jpg 2x, 3x.jpg 3x" media="(min-width: 600px)" type="image/jpeg"></data-src>
    //   <data-src srcset="1x.jpg 1x, 2x.jpg 2x, 3x.jpg 3x" media="(min-width: 400px)" type="image/jpeg"></data-src>
    // </picture>
    //
    // or just with attributes in one line:
    // <picture data-src="default.jpg" data-srcset="1x.jpg 1x, 2x.jpg 2x, 3x.jpg 3x" data-media="(min-width: 600px)" data-sizes="" data-type="image/jpeg" />
    $.lazy(['pic', 'picture'], ['picture'], function(element, response) {
        var elementTagName = element[0].tagName.toLowerCase();

        if (elementTagName === 'picture') {
            var sources = element.find(srcAttr),
                image = element.find('data-img'),
                imageBase = this.config('imageBase') || '';

            // handle as child elements
            if (sources.length) {
                sources.each(function() {
                    renameElementTag($(this), 'source', imageBase);
                });

                // create img tag from child
                if (image.length === 1) {
                    image = renameElementTag(image, 'img', imageBase);

                    // bind event callbacks to new image tag
                    image.on('load', function() {
                        response(true);
                    }).on('error', function() {
                        response(false);
                    });

                    image.attr('src', image.attr(srcAttr));

                    if (this.config('removeAttribute')) {
                        image.removeAttr(srcAttr);
                    }
                }

                // create img tag from attribute
                else if (element.attr(srcAttr)) {
                    // create image tag
                    createImageObject(element, imageBase + element.attr(srcAttr), response);

                    if (this.config('removeAttribute')) {
                        element.removeAttr(srcAttr);
                    }
                }

                // pass error state
                else {
                    // use response function for Zepto
                    response(false);
                }
            }

            // handle as attributes
            else if( element.attr(srcsetAttr) ) {
                // create source elements before img tag
                $('<source>').attr({
                    media: element.attr(mediaAttr),
                    sizes: element.attr(sizesAttr),
                    type: element.attr(typeAttr),
                    srcset: getCorrectedSrcSet(element.attr(srcsetAttr), imageBase)
                })
                .appendTo(element);

                // create image tag
                createImageObject(element, imageBase + element.attr(srcAttr), response);

                // remove attributes from parent picture element
                if (this.config('removeAttribute')) {
                    element.removeAttr(srcAttr + ' ' + srcsetAttr + ' ' + mediaAttr + ' ' + sizesAttr + ' ' + typeAttr);
                }
            }

            // pass error state
            else {
                // use response function for Zepto
                response(false);
            }
        }

        else {
            // pass error state
            // use response function for Zepto
            response(false);
        }
    });

    /**
     * create a new child element and copy attributes
     * @param {jQuery|object} element
     * @param {string} toType
     * @param {string} imageBase
     * @return {jQuery|object}
     */
    function renameElementTag(element, toType, imageBase) {
        var attributes = element.prop('attributes'),
            target = $('<' + toType + '>');

        $.each(attributes, function(index, attribute) {
            // build srcset with image base
            if (attribute.name === 'srcset' || attribute.name === srcAttr) {
                attribute.value = getCorrectedSrcSet(attribute.value, imageBase);
            }

            target.attr(attribute.name, attribute.value);
        });

        element.replaceWith(target);
        return target;
    }

    /**
     * create a new image element inside parent element
     * @param {jQuery|object} parent
     * @param {string} src
     * @param {function} response
     * @return void
     */
    function createImageObject(parent, src, response) {
        // create image tag
        var imageObj = $('<img>')

        // create image tag an bind callbacks for correct response
        .one('load', function() {
            response(true);
        })
        .one('error', function() {
            response(false);
        })

        // set into picture element
        .appendTo(parent)

        // set src attribute at last to prevent early kick-in
        .attr('src', src);

        // call after load even on cached image
        imageObj.complete && imageObj.load(); // jshint ignore : line
    }

    /**
     * prepend image base to all srcset entries
     * @param {string} srcset
     * @param {string} imageBase
     * @returns {string}
     */
    function getCorrectedSrcSet(srcset, imageBase) {
        if (imageBase) {
            // trim, remove unnecessary spaces and split entries
            var entries = srcset.split(',');
            srcset = '';

            for (var i = 0, l = entries.length; i < l; i++) {
                srcset += imageBase + entries[i].trim() + (i !== l - 1 ? ',' : '');
            }
        }

        return srcset;
    }
})(window.jQuery || window.Zepto);

/*!
 * jQuery & Zepto Lazy - Script Plugin - v1.2
 * http://jquery.eisbehr.de/lazy/
 *
 * Copyright 2012 - 2018, Daniel 'Eisbehr' Kern
 *
 * Dual licensed under the MIT and GPL-2.0 licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl-2.0.html
 */
;(function($) {
    // loads javascript files for script tags, like:
    // <script data-src="file.js" type="text/javascript"></script>
    $.lazy(['js', 'javascript', 'script'], 'script', function(element, response) {
        if (element[0].tagName.toLowerCase() === 'script') {
            element.attr('src', element.attr('data-src'));

            // remove attribute
            if (this.config('removeAttribute')) {
                element.removeAttr('data-src');
            }
        }
        else {
            // use response function for Zepto
            response(false);
        }
    });
})(window.jQuery || window.Zepto);

/*!
 * jQuery & Zepto Lazy - Vimeo Plugin - v1.1
 * http://jquery.eisbehr.de/lazy/
 *
 * Copyright 2012 - 2018, Daniel 'Eisbehr' Kern
 *
 * Dual licensed under the MIT and GPL-2.0 licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl-2.0.html
 */
;(function($) {
    // load vimeo video iframe, like:
    // <iframe data-loader="vimeo" data-src="176894130" width="640" height="360" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>
    $.lazy('vimeo', function(element, response) {
        if (element[0].tagName.toLowerCase() === 'iframe') {
            // pass source to iframe
            element.attr('src', 'https://player.vimeo.com/video/' + element.attr('data-src'));

            // remove attribute
            if (this.config('removeAttribute')) {
                element.removeAttr('data-src');
            }
        }

        else {
            // pass error state
            // use response function for Zepto
            response(false);
        }
    });
})(window.jQuery || window.Zepto);

/*!
 * jQuery & Zepto Lazy - YouTube Plugin - v1.5
 * http://jquery.eisbehr.de/lazy/
 *
 * Copyright 2012 - 2018, Daniel 'Eisbehr' Kern
 *
 * Dual licensed under the MIT and GPL-2.0 licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl-2.0.html
 */
;(function($) {
    // load youtube video iframe, like:
    // <iframe data-loader="yt" data-src="1AYGnw6MwFM" data-nocookie="1" width="560" height="315" frameborder="0" allowfullscreen></iframe>
    $.lazy(['yt', 'youtube'], function(element, response) {
        if (element[0].tagName.toLowerCase() === 'iframe') {
            // pass source to iframe
            var noCookie = /1|true/.test(element.attr('data-nocookie'));
            element.attr('src', 'https://www.youtube' + (noCookie ? '-nocookie' : '') + '.com/embed/' + element.attr('data-src') + '?rel=0&amp;showinfo=0');

            // remove attribute
            if (this.config('removeAttribute')) {
                element.removeAttr('data-src');
            }
        }

        else {
            // pass error state
            response(false);
        }
    });
})(window.jQuery || window.Zepto);
/*! jQuery & Zepto Lazy - All Plugins v1.7.10 - http://jquery.eisbehr.de/lazy - MIT&GPL-2.0 license - Copyright 2012-2018 Daniel 'Eisbehr' Kern */
!function(t){function a(a,e,r,o){o=o?o.toUpperCase():"GET";var i;"POST"!==o&&"PUT"!==o||!a.config("ajaxCreateData")||(i=a.config("ajaxCreateData").apply(a,[e])),t.ajax({url:e.attr("data-src"),type:"POST"===o||"PUT"===o?o:"GET",data:i,dataType:e.attr("data-type")||"html",success:function(t){e.html(t),r(!0),a.config("removeAttribute")&&e.removeAttr("data-src data-method data-type")},error:function(){r(!1)}})}t.lazy("ajax",function(t,e){a(this,t,e,t.attr("data-method"))}),t.lazy("get",function(t,e){a(this,t,e,"GET")}),t.lazy("post",function(t,e){a(this,t,e,"POST")}),t.lazy("put",function(t,e){a(this,t,e,"PUT")})}(window.jQuery||window.Zepto),function(t){t.lazy(["av","audio","video"],["audio","video"],function(a,e){var r=a[0].tagName.toLowerCase();if("audio"===r||"video"===r){var o=a.find("data-src"),i=a.find("data-track"),n=0,c=function(){++n===o.length&&e(!1)},s=function(){var a=t(this),e=a[0].tagName.toLowerCase(),r=a.prop("attributes"),o=t("data-src"===e?"<source>":"<track>");"data-src"===e&&o.one("error",c),t.each(r,function(t,a){o.attr(a.name,a.value)}),a.replaceWith(o)};a.one("loadedmetadata",function(){e(!0)}).off("load error").attr("poster",a.attr("data-poster")),o.length?o.each(s):a.attr("data-src")?(t.each(a.attr("data-src").split(","),function(e,r){var o=r.split("|");a.append(t("<source>").one("error",c).attr({src:o[0].trim(),type:o[1].trim()}))}),this.config("removeAttribute")&&a.removeAttr("data-src")):e(!1),i.length&&i.each(s)}else e(!1)})}(window.jQuery||window.Zepto),function(t){t.lazy(["frame","iframe"],"iframe",function(a,e){var r=this;if("iframe"===a[0].tagName.toLowerCase()){var o=a.attr("data-error-detect");"true"!==o&&"1"!==o?(a.attr("src",a.attr("data-src")),r.config("removeAttribute")&&a.removeAttr("data-src data-error-detect")):t.ajax({url:a.attr("data-src"),dataType:"html",crossDomain:!0,xhrFields:{withCredentials:!0},success:function(t){a.html(t).attr("src",a.attr("data-src")),r.config("removeAttribute")&&a.removeAttr("data-src data-error-detect")},error:function(){e(!1)}})}else e(!1)})}(window.jQuery||window.Zepto),function(t){t.lazy("noop",function(){}),t.lazy("noop-success",function(t,a){a(!0)}),t.lazy("noop-error",function(t,a){a(!1)})}(window.jQuery||window.Zepto),function(t){function a(a,e,i){var n=a.prop("attributes"),c=t("<"+e+">");return t.each(n,function(t,a){"srcset"!==a.name&&a.name!==o||(a.value=r(a.value,i)),c.attr(a.name,a.value)}),a.replaceWith(c),c}function e(a,e,r){var o=t("<img>").one("load",function(){r(!0)}).one("error",function(){r(!1)}).appendTo(a).attr("src",e);o.complete&&o.load()}function r(t,a){if(a){var e=t.split(",");t="";for(var r=0,o=e.length;r<o;r++)t+=a+e[r].trim()+(r!==o-1?",":"")}return t}var o="data-src";t.lazy(["pic","picture"],["picture"],function(i,n){if("picture"===i[0].tagName.toLowerCase()){var c=i.find(o),s=i.find("data-img"),d=this.config("imageBase")||"";c.length?(c.each(function(){a(t(this),"source",d)}),1===s.length?(s=a(s,"img",d),s.on("load",function(){n(!0)}).on("error",function(){n(!1)}),s.attr("src",s.attr(o)),this.config("removeAttribute")&&s.removeAttr(o)):i.attr(o)?(e(i,d+i.attr(o),n),this.config("removeAttribute")&&i.removeAttr(o)):n(!1)):i.attr("data-srcset")?(t("<source>").attr({media:i.attr("data-media"),sizes:i.attr("data-sizes"),type:i.attr("data-type"),srcset:r(i.attr("data-srcset"),d)}).appendTo(i),e(i,d+i.attr(o),n),this.config("removeAttribute")&&i.removeAttr(o+" data-srcset data-media data-sizes data-type")):n(!1)}else n(!1)})}(window.jQuery||window.Zepto),function(t){t.lazy(["js","javascript","script"],"script",function(t,a){"script"===t[0].tagName.toLowerCase()?(t.attr("src",t.attr("data-src")),this.config("removeAttribute")&&t.removeAttr("data-src")):a(!1)})}(window.jQuery||window.Zepto),function(t){t.lazy("vimeo",function(t,a){"iframe"===t[0].tagName.toLowerCase()?(t.attr("src","https://player.vimeo.com/video/"+t.attr("data-src")),this.config("removeAttribute")&&t.removeAttr("data-src")):a(!1)})}(window.jQuery||window.Zepto),function(t){t.lazy(["yt","youtube"],function(t,a){if("iframe"===t[0].tagName.toLowerCase()){var e=/1|true/.test(t.attr("data-nocookie"));t.attr("src","https://www.youtube"+(e?"-nocookie":"")+".com/embed/"+t.attr("data-src")+"?rel=0&amp;showinfo=0"),this.config("removeAttribute")&&t.removeAttr("data-src")}else a(!1)})}(window.jQuery||window.Zepto);
; var load = (function(w, d, undefined) {

  "use strict";
  var is_not_loaded_yet = true;
  var init = function() {
    var classes = document.body.classList;
    for (var i = classes.length - 1; i >= 0; i--) {
      if(classes[i] == "loaded"){
          is_not_loaded_yet = false;
      };
    }
    if(is_not_loaded_yet){
      is_not_loaded_yet = false;
      setTimeout(function(){ document.body.classList += " loaded"; }, 300);
      setTimeout(function(){ document.body.classList += " fadout"; }, 450);
    }
  };

  d.addEventListener('DOMContentLoaded', init);

  return {
    init:init
  };

}(window, window.document));
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
; var nav = (function(w, d, undefined) {

  "use strict";

  var init = function() {
    var pathname = window.location.pathname;
    pathname = pathname.split("/");
    var $obj = $(".nav-link[data-slug*='" + pathname[1] + "']").addClass('active');

  };

  d.addEventListener('load', init);

  return {
    init:init
  };

}(window, window.document));
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
; var header = (function(w, d, undefined) {

  "use strict";

  var init = function() {
    scrollit()
    window.addEventListener("scroll", function() {
      var stheader = window.pageYOffset || document.body.scrollTop || document.documentElement.scrollTop,
      header = document.querySelectorAll( '.header:not(.shrink)' );
      if (stheader >= 1) {
        if (header[0] != undefined) {
          header[0].className += ' shrink';
        }
      } else {
        header = document.querySelectorAll( '.header' );
        if (header[0] != undefined) {
          header[0].className = 'header';
        }
      }
    }, false);

  },
  scrollit = function() {
    var stheader = window.pageYOffset || document.body.scrollTop || document.documentElement.scrollTop,
    header = document.querySelectorAll( '.header:not(.shrink)' );
    if (stheader >= 2) {
      if (header[0] != undefined) {
        header[0].className += ' shrink';
      }
    } else {
      header = document.querySelectorAll( '.header' );
      if (header[0] != undefined) {
        header[0].className = 'header';
      }
    }
  };

  d.addEventListener('load', init);

  return {
    init:init
  };

}(window, window.document));
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImpxdWVyeS5sYXp5LmpzIiwianF1ZXJ5LmxhenkubWluLmpzIiwianF1ZXJ5LmxhenkucGx1Z2lucy5qcyIsImpxdWVyeS5sYXp5LnBsdWdpbnMubWluLmpzIiwic2NyaXB0cy9fbG9hZC5qcyIsIm1haW4uanMiLCJhbGJ1bWdhbGxlcnkvYWxidW1nYWxsZXJ5LmpzIiwibmF2L25hdi5qcyIsInBhZ2Vwb3NpdGlvbi9wYWdlcG9zaXRpb24uanMiLCJoZWFkZXIvaGVhZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN2MkJBO0FBQ0E7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM3bEJBO0FBQ0E7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6Im1haW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiFcbiAqIGpRdWVyeSAmIFplcHRvIExhenkgLSB2MS43LjEwXG4gKiBodHRwOi8vanF1ZXJ5LmVpc2JlaHIuZGUvbGF6eS9cbiAqXG4gKiBDb3B5cmlnaHQgMjAxMiAtIDIwMTgsIERhbmllbCAnRWlzYmVocicgS2VyblxuICpcbiAqIER1YWwgbGljZW5zZWQgdW5kZXIgdGhlIE1JVCBhbmQgR1BMLTIuMCBsaWNlbnNlczpcbiAqIGh0dHA6Ly93d3cub3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvbWl0LWxpY2Vuc2UucGhwXG4gKiBodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvZ3BsLTIuMC5odG1sXG4gKlxuICogJChcImltZy5sYXp5XCIpLmxhenkoKTtcbiAqL1xuXG47KGZ1bmN0aW9uKHdpbmRvdywgdW5kZWZpbmVkKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICAvLyBub2luc3BlY3Rpb24gSlNVbnJlc29sdmVkVmFyaWFibGVcbiAgICAvKipcbiAgICAgKiBsaWJyYXJ5IGluc3RhbmNlIC0gaGVyZSBhbmQgbm90IGluIGNvbnN0cnVjdCB0byBiZSBzaG9ydGVyIGluIG1pbmltaXphdGlvblxuICAgICAqIEByZXR1cm4gdm9pZFxuICAgICAqL1xuICAgIHZhciAkID0gd2luZG93LmpRdWVyeSB8fCB3aW5kb3cuWmVwdG8sXG5cbiAgICAvKipcbiAgICAgKiB1bmlxdWUgcGx1Z2luIGluc3RhbmNlIGlkIGNvdW50ZXJcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGxhenlJbnN0YW5jZUlkID0gMCxcblxuICAgIC8qKlxuICAgICAqIGhlbHBlciB0byByZWdpc3RlciB3aW5kb3cgbG9hZCBmb3IgalF1ZXJ5IDNcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi8gICAgXG4gICAgd2luZG93TG9hZGVkID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBtYWtlIGxhenkgYXZhaWxhYmxlIHRvIGpxdWVyeSAtIGFuZCBtYWtlIGl0IGEgYml0IG1vcmUgY2FzZS1pbnNlbnNpdGl2ZSA6KVxuICAgICAqIEBhY2Nlc3MgcHVibGljXG4gICAgICogQHR5cGUge2Z1bmN0aW9ufVxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBzZXR0aW5nc1xuICAgICAqIEByZXR1cm4ge0xhenlQbHVnaW59XG4gICAgICovXG4gICAgJC5mbi5MYXp5ID0gJC5mbi5sYXp5ID0gZnVuY3Rpb24oc2V0dGluZ3MpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBMYXp5UGx1Z2luKHRoaXMsIHNldHRpbmdzKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogaGVscGVyIHRvIGFkZCBwbHVnaW5zIHRvIGxhenkgcHJvdG90eXBlIGNvbmZpZ3VyYXRpb25cbiAgICAgKiBAYWNjZXNzIHB1YmxpY1xuICAgICAqIEB0eXBlIHtmdW5jdGlvbn1cbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xBcnJheX0gbmFtZXNcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xBcnJheXxmdW5jdGlvbn0gW2VsZW1lbnRzXVxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IGxvYWRlclxuICAgICAqIEByZXR1cm4gdm9pZFxuICAgICAqL1xuICAgICQuTGF6eSA9ICQubGF6eSA9IGZ1bmN0aW9uKG5hbWVzLCBlbGVtZW50cywgbG9hZGVyKSB7XG4gICAgICAgIC8vIG1ha2Ugc2Vjb25kIHBhcmFtZXRlciBvcHRpb25hbFxuICAgICAgICBpZiAoJC5pc0Z1bmN0aW9uKGVsZW1lbnRzKSkge1xuICAgICAgICAgICAgbG9hZGVyID0gZWxlbWVudHM7XG4gICAgICAgICAgICBlbGVtZW50cyA9IFtdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZXhpdCBoZXJlIGlmIHBhcmFtZXRlciBpcyBub3QgYSBjYWxsYWJsZSBmdW5jdGlvblxuICAgICAgICBpZiAoISQuaXNGdW5jdGlvbihsb2FkZXIpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtYWtlIHBhcmFtZXRlcnMgYW4gYXJyYXkgb2YgbmFtZXMgdG8gYmUgc3VyZVxuICAgICAgICBuYW1lcyA9ICQuaXNBcnJheShuYW1lcykgPyBuYW1lcyA6IFtuYW1lc107XG4gICAgICAgIGVsZW1lbnRzID0gJC5pc0FycmF5KGVsZW1lbnRzKSA/IGVsZW1lbnRzIDogW2VsZW1lbnRzXTtcblxuICAgICAgICB2YXIgY29uZmlnID0gTGF6eVBsdWdpbi5wcm90b3R5cGUuY29uZmlnLFxuICAgICAgICAgICAgZm9yY2VkID0gY29uZmlnLl9mIHx8IChjb25maWcuX2YgPSB7fSk7XG5cbiAgICAgICAgLy8gYWRkIHRoZSBsb2FkZXIgcGx1Z2luIGZvciBldmVyeSBuYW1lXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbmFtZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoY29uZmlnW25hbWVzW2ldXSA9PT0gdW5kZWZpbmVkIHx8ICQuaXNGdW5jdGlvbihjb25maWdbbmFtZXNbaV1dKSkge1xuICAgICAgICAgICAgICAgIGNvbmZpZ1tuYW1lc1tpXV0gPSBsb2FkZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhZGQgZm9yY2VkIGVsZW1lbnRzIGxvYWRlclxuICAgICAgICBmb3IgKHZhciBjID0gMCwgYSA9IGVsZW1lbnRzLmxlbmd0aDsgYyA8IGE7IGMrKykge1xuICAgICAgICAgICAgZm9yY2VkW2VsZW1lbnRzW2NdXSA9IG5hbWVzWzBdO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIGNvbnRhaW5zIGFsbCBsb2dpYyBhbmQgdGhlIHdob2xlIGVsZW1lbnQgaGFuZGxpbmdcbiAgICAgKiBpcyBwYWNrZWQgaW4gYSBwcml2YXRlIGZ1bmN0aW9uIG91dHNpZGUgY2xhc3MgdG8gcmVkdWNlIG1lbW9yeSB1c2FnZSwgYmVjYXVzZSBpdCB3aWxsIG5vdCBiZSBjcmVhdGVkIG9uIGV2ZXJ5IHBsdWdpbiBpbnN0YW5jZVxuICAgICAqIEBhY2Nlc3MgcHJpdmF0ZVxuICAgICAqIEB0eXBlIHtmdW5jdGlvbn1cbiAgICAgKiBAcGFyYW0ge0xhenlQbHVnaW59IGluc3RhbmNlXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGNvbmZpZ1xuICAgICAqIEBwYXJhbSB7b2JqZWN0fEFycmF5fSBpdGVtc1xuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBldmVudHNcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZXNwYWNlXG4gICAgICogQHJldHVybiB2b2lkXG4gICAgICovXG4gICAgZnVuY3Rpb24gX2V4ZWN1dGVMYXp5KGluc3RhbmNlLCBjb25maWcsIGl0ZW1zLCBldmVudHMsIG5hbWVzcGFjZSkge1xuICAgICAgICAvKipcbiAgICAgICAgICogYSBoZWxwZXIgdG8gdHJpZ2dlciB0aGUgJ29uRmluaXNoZWRBbGwnIGNhbGxiYWNrIGFmdGVyIGFsbCBvdGhlciBldmVudHNcbiAgICAgICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB2YXIgX2F3YWl0aW5nQWZ0ZXJMb2FkID0gMCxcblxuICAgICAgICAvKipcbiAgICAgICAgICogdmlzaWJsZSBjb250ZW50IHdpZHRoXG4gICAgICAgICAqIEBhY2Nlc3MgcHJpdmF0ZVxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgX2FjdHVhbFdpZHRoID0gLTEsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHZpc2libGUgY29udGVudCBoZWlnaHRcbiAgICAgICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICBfYWN0dWFsSGVpZ2h0ID0gLTEsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGRldGVybWluZSBwb3NzaWJseSBkZXRlY3RlZCBoaWdoIHBpeGVsIGRlbnNpdHlcbiAgICAgICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgX2lzUmV0aW5hRGlzcGxheSA9IGZhbHNlLCBcblxuICAgICAgICAvKipcbiAgICAgICAgICogZGljdGlvbmFyeSBlbnRyeSBmb3IgYmV0dGVyIG1pbmltaXphdGlvblxuICAgICAgICAgKiBAYWNjZXNzIHByaXZhdGVcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIF9hZnRlckxvYWQgPSAnYWZ0ZXJMb2FkJyxcblxuICAgICAgICAvKipcbiAgICAgICAgICogZGljdGlvbmFyeSBlbnRyeSBmb3IgYmV0dGVyIG1pbmltaXphdGlvblxuICAgICAgICAgKiBAYWNjZXNzIHByaXZhdGVcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIF9sb2FkID0gJ2xvYWQnLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBkaWN0aW9uYXJ5IGVudHJ5IGZvciBiZXR0ZXIgbWluaW1pemF0aW9uXG4gICAgICAgICAqIEBhY2Nlc3MgcHJpdmF0ZVxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgX2Vycm9yID0gJ2Vycm9yJyxcblxuICAgICAgICAvKipcbiAgICAgICAgICogZGljdGlvbmFyeSBlbnRyeSBmb3IgYmV0dGVyIG1pbmltaXphdGlvblxuICAgICAgICAgKiBAYWNjZXNzIHByaXZhdGVcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIF9pbWcgPSAnaW1nJyxcblxuICAgICAgICAvKipcbiAgICAgICAgICogZGljdGlvbmFyeSBlbnRyeSBmb3IgYmV0dGVyIG1pbmltaXphdGlvblxuICAgICAgICAgKiBAYWNjZXNzIHByaXZhdGVcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIF9zcmMgPSAnc3JjJyxcblxuICAgICAgICAvKipcbiAgICAgICAgICogZGljdGlvbmFyeSBlbnRyeSBmb3IgYmV0dGVyIG1pbmltaXphdGlvblxuICAgICAgICAgKiBAYWNjZXNzIHByaXZhdGVcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIF9zcmNzZXQgPSAnc3Jjc2V0JyxcblxuICAgICAgICAvKipcbiAgICAgICAgICogZGljdGlvbmFyeSBlbnRyeSBmb3IgYmV0dGVyIG1pbmltaXphdGlvblxuICAgICAgICAgKiBAYWNjZXNzIHByaXZhdGVcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIF9zaXplcyA9ICdzaXplcycsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGRpY3Rpb25hcnkgZW50cnkgZm9yIGJldHRlciBtaW5pbWl6YXRpb25cbiAgICAgICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICBfYmFja2dyb3VuZEltYWdlID0gJ2JhY2tncm91bmQtaW1hZ2UnO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBpbml0aWFsaXplIHBsdWdpblxuICAgICAgICAgKiBiaW5kIGxvYWRpbmcgdG8gZXZlbnRzIG9yIHNldCBkZWxheSB0aW1lIHRvIGxvYWQgYWxsIGl0ZW1zIGF0IG9uY2VcbiAgICAgICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICAgICAqIEByZXR1cm4gdm9pZFxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gX2luaXRpYWxpemUoKSB7XG4gICAgICAgICAgICAvLyBkZXRlY3QgYWN0dWFsIGRldmljZSBwaXhlbCByYXRpb1xuICAgICAgICAgICAgLy8gbm9pbnNwZWN0aW9uIEpTVW5yZXNvbHZlZFZhcmlhYmxlXG4gICAgICAgICAgICBfaXNSZXRpbmFEaXNwbGF5ID0gd2luZG93LmRldmljZVBpeGVsUmF0aW8gPiAxO1xuXG4gICAgICAgICAgICAvLyBwcmVwYXJlIGFsbCBpbml0aWFsIGl0ZW1zXG4gICAgICAgICAgICBpdGVtcyA9IF9wcmVwYXJlSXRlbXMoaXRlbXMpO1xuXG4gICAgICAgICAgICAvLyBpZiBkZWxheSB0aW1lIGlzIHNldCBsb2FkIGFsbCBpdGVtcyBhdCBvbmNlIGFmdGVyIGRlbGF5IHRpbWVcbiAgICAgICAgICAgIGlmIChjb25maWcuZGVsYXkgPj0gMCkge1xuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIF9sYXp5TG9hZEl0ZW1zKHRydWUpO1xuICAgICAgICAgICAgICAgIH0sIGNvbmZpZy5kZWxheSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGlmIG5vIGRlbGF5IGlzIHNldCBvciBjb21iaW5lIHVzYWdlIGlzIGFjdGl2ZSBiaW5kIGV2ZW50c1xuICAgICAgICAgICAgaWYgKGNvbmZpZy5kZWxheSA8IDAgfHwgY29uZmlnLmNvbWJpbmVkKSB7XG4gICAgICAgICAgICAgICAgLy8gY3JlYXRlIHVuaXF1ZSBldmVudCBmdW5jdGlvblxuICAgICAgICAgICAgICAgIGV2ZW50cy5lID0gX3Rocm90dGxlKGNvbmZpZy50aHJvdHRsZSwgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcmVzZXQgZGV0ZWN0ZWQgd2luZG93IHNpemUgb24gcmVzaXplIGV2ZW50XG4gICAgICAgICAgICAgICAgICAgIGlmIChldmVudC50eXBlID09PSAncmVzaXplJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgX2FjdHVhbFdpZHRoID0gX2FjdHVhbEhlaWdodCA9IC0xO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gZXhlY3V0ZSAnbGF6eSBtYWdpYydcbiAgICAgICAgICAgICAgICAgICAgX2xhenlMb2FkSXRlbXMoZXZlbnQuYWxsKTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBmdW5jdGlvbiB0byBhZGQgbmV3IGl0ZW1zIHRvIGluc3RhbmNlXG4gICAgICAgICAgICAgICAgZXZlbnRzLmEgPSBmdW5jdGlvbihhZGRpdGlvbmFsSXRlbXMpIHtcbiAgICAgICAgICAgICAgICAgICAgYWRkaXRpb25hbEl0ZW1zID0gX3ByZXBhcmVJdGVtcyhhZGRpdGlvbmFsSXRlbXMpO1xuICAgICAgICAgICAgICAgICAgICBpdGVtcy5wdXNoLmFwcGx5KGl0ZW1zLCBhZGRpdGlvbmFsSXRlbXMpO1xuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAvLyBjcmVhdGUgZnVuY3Rpb24gdG8gZ2V0IGFsbCBpbnN0YW5jZSBpdGVtcyBsZWZ0XG4gICAgICAgICAgICAgICAgZXZlbnRzLmcgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gZmlsdGVyIGxvYWRlZCBpdGVtcyBiZWZvcmUgcmV0dXJuIGluIGNhc2UgaW50ZXJuYWwgZmlsdGVyIHdhcyBub3QgcnVubmluZyB1bnRpbCBub3dcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChpdGVtcyA9ICQoaXRlbXMpLmZpbHRlcihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAhJCh0aGlzKS5kYXRhKGNvbmZpZy5sb2FkZWROYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAvLyBjcmVhdGUgZnVuY3Rpb24gdG8gZm9yY2UgbG9hZGluZyBlbGVtZW50c1xuICAgICAgICAgICAgICAgIGV2ZW50cy5mID0gZnVuY3Rpb24oZm9yY2VkSXRlbXMpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBmb3JjZWRJdGVtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gb25seSBoYW5kbGUgaXRlbSBpZiBhdmFpbGFibGUgaW4gY3VycmVudCBpbnN0YW5jZVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdXNlIGEgY29tcGFyZSBmdW5jdGlvbiwgYmVjYXVzZSBaZXB0byBjYW4ndCBoYW5kbGUgb2JqZWN0IHBhcmFtZXRlciBmb3IgZmlsdGVyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB2YXIgaXRlbSA9IGl0ZW1zLmZpbHRlcihmb3JjZWRJdGVtc1tpXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAvKiBqc2hpbnQgbG9vcGZ1bmM6IHRydWUgKi9cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBpdGVtID0gaXRlbXMuZmlsdGVyKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzID09PSBmb3JjZWRJdGVtc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXRlbS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfbGF6eUxvYWRJdGVtcyhmYWxzZSwgaXRlbSk7ICAgXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgLy8gbG9hZCBpbml0aWFsIGl0ZW1zXG4gICAgICAgICAgICAgICAgX2xhenlMb2FkSXRlbXMoKTtcblxuICAgICAgICAgICAgICAgIC8vIGJpbmQgbGF6eSBsb2FkIGZ1bmN0aW9ucyB0byBzY3JvbGwgYW5kIHJlc2l6ZSBldmVudFxuICAgICAgICAgICAgICAgIC8vIG5vaW5zcGVjdGlvbiBKU1VucmVzb2x2ZWRWYXJpYWJsZVxuICAgICAgICAgICAgICAgICQoY29uZmlnLmFwcGVuZFNjcm9sbCkub24oJ3Njcm9sbC4nICsgbmFtZXNwYWNlICsgJyByZXNpemUuJyArIG5hbWVzcGFjZSwgZXZlbnRzLmUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHByZXBhcmUgaXRlbXMgYmVmb3JlIGhhbmRsZSB0aGVtXG4gICAgICAgICAqIEBhY2Nlc3MgcHJpdmF0ZVxuICAgICAgICAgKiBAcGFyYW0ge0FycmF5fG9iamVjdHxqUXVlcnl9IGl0ZW1zXG4gICAgICAgICAqIEByZXR1cm4ge0FycmF5fG9iamVjdHxqUXVlcnl9XG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBfcHJlcGFyZUl0ZW1zKGl0ZW1zKSB7XG4gICAgICAgICAgICAvLyBmZXRjaCB1c2VkIGNvbmZpZ3VyYXRpb25zIGJlZm9yZSBsb29wc1xuICAgICAgICAgICAgdmFyIGRlZmF1bHRJbWFnZSA9IGNvbmZpZy5kZWZhdWx0SW1hZ2UsXG4gICAgICAgICAgICAgICAgcGxhY2Vob2xkZXIgPSBjb25maWcucGxhY2Vob2xkZXIsXG4gICAgICAgICAgICAgICAgaW1hZ2VCYXNlID0gY29uZmlnLmltYWdlQmFzZSxcbiAgICAgICAgICAgICAgICBzcmNzZXRBdHRyaWJ1dGUgPSBjb25maWcuc3Jjc2V0QXR0cmlidXRlLFxuICAgICAgICAgICAgICAgIGxvYWRlckF0dHJpYnV0ZSA9IGNvbmZpZy5sb2FkZXJBdHRyaWJ1dGUsXG4gICAgICAgICAgICAgICAgZm9yY2VkVGFncyA9IGNvbmZpZy5fZiB8fCB7fTtcblxuICAgICAgICAgICAgLy8gZmlsdGVyIGl0ZW1zIGFuZCBvbmx5IGFkZCB0aG9zZSB3aG8gbm90IGhhbmRsZWQgeWV0IGFuZCBnb3QgbmVlZGVkIGF0dHJpYnV0ZXMgYXZhaWxhYmxlXG4gICAgICAgICAgICBpdGVtcyA9ICQoaXRlbXMpLmZpbHRlcihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2YXIgZWxlbWVudCA9ICQodGhpcyksXG4gICAgICAgICAgICAgICAgICAgIHRhZyA9IF9nZXRFbGVtZW50VGFnTmFtZSh0aGlzKTtcblxuICAgICAgICAgICAgICAgIHJldHVybiAhZWxlbWVudC5kYXRhKGNvbmZpZy5oYW5kbGVkTmFtZSkgJiYgXG4gICAgICAgICAgICAgICAgICAgICAgIChlbGVtZW50LmF0dHIoY29uZmlnLmF0dHJpYnV0ZSkgfHwgZWxlbWVudC5hdHRyKHNyY3NldEF0dHJpYnV0ZSkgfHwgZWxlbWVudC5hdHRyKGxvYWRlckF0dHJpYnV0ZSkgfHwgZm9yY2VkVGFnc1t0YWddICE9PSB1bmRlZmluZWQpO1xuICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgLy8gYXBwZW5kIHBsdWdpbiBpbnN0YW5jZSB0byBhbGwgZWxlbWVudHNcbiAgICAgICAgICAgIC5kYXRhKCdwbHVnaW5fJyArIGNvbmZpZy5uYW1lLCBpbnN0YW5jZSk7XG5cbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gaXRlbXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGVsZW1lbnQgPSAkKGl0ZW1zW2ldKSxcbiAgICAgICAgICAgICAgICAgICAgdGFnID0gX2dldEVsZW1lbnRUYWdOYW1lKGl0ZW1zW2ldKSxcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudEltYWdlQmFzZSA9IGVsZW1lbnQuYXR0cihjb25maWcuaW1hZ2VCYXNlQXR0cmlidXRlKSB8fCBpbWFnZUJhc2U7XG5cbiAgICAgICAgICAgICAgICAvLyBnZW5lcmF0ZSBhbmQgdXBkYXRlIHNvdXJjZSBzZXQgaWYgYW4gaW1hZ2UgYmFzZSBpcyBzZXRcbiAgICAgICAgICAgICAgICBpZiAodGFnID09PSBfaW1nICYmIGVsZW1lbnRJbWFnZUJhc2UgJiYgZWxlbWVudC5hdHRyKHNyY3NldEF0dHJpYnV0ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5hdHRyKHNyY3NldEF0dHJpYnV0ZSwgX2dldENvcnJlY3RlZFNyY1NldChlbGVtZW50LmF0dHIoc3Jjc2V0QXR0cmlidXRlKSwgZWxlbWVudEltYWdlQmFzZSkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGFkZCBsb2FkZXIgdG8gZm9yY2VkIGVsZW1lbnQgdHlwZXNcbiAgICAgICAgICAgICAgICBpZiAoZm9yY2VkVGFnc1t0YWddICE9PSB1bmRlZmluZWQgJiYgIWVsZW1lbnQuYXR0cihsb2FkZXJBdHRyaWJ1dGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuYXR0cihsb2FkZXJBdHRyaWJ1dGUsIGZvcmNlZFRhZ3NbdGFnXSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gc2V0IGRlZmF1bHQgaW1hZ2Ugb24gZXZlcnkgZWxlbWVudCB3aXRob3V0IHNvdXJjZVxuICAgICAgICAgICAgICAgIGlmICh0YWcgPT09IF9pbWcgJiYgZGVmYXVsdEltYWdlICYmICFlbGVtZW50LmF0dHIoX3NyYykpIHtcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5hdHRyKF9zcmMsIGRlZmF1bHRJbWFnZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gc2V0IHBsYWNlaG9sZGVyIG9uIGV2ZXJ5IGVsZW1lbnQgd2l0aG91dCBiYWNrZ3JvdW5kIGltYWdlXG4gICAgICAgICAgICAgICAgZWxzZSBpZiAodGFnICE9PSBfaW1nICYmIHBsYWNlaG9sZGVyICYmICghZWxlbWVudC5jc3MoX2JhY2tncm91bmRJbWFnZSkgfHwgZWxlbWVudC5jc3MoX2JhY2tncm91bmRJbWFnZSkgPT09ICdub25lJykpIHtcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5jc3MoX2JhY2tncm91bmRJbWFnZSwgXCJ1cmwoJ1wiICsgcGxhY2Vob2xkZXIgKyBcIicpXCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGl0ZW1zO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHRoZSAnbGF6eSBtYWdpYycgLSBjaGVjayBhbGwgaXRlbXNcbiAgICAgICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2FsbEl0ZW1zXVxuICAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gW2ZvcmNlZF1cbiAgICAgICAgICogQHJldHVybiB2b2lkXG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBfbGF6eUxvYWRJdGVtcyhhbGxJdGVtcywgZm9yY2VkKSB7XG4gICAgICAgICAgICAvLyBza2lwIGlmIG5vIGl0ZW1zIHdoZXJlIGxlZnRcbiAgICAgICAgICAgIGlmICghaXRlbXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgLy8gZGVzdHJveSBpbnN0YW5jZSBpZiBvcHRpb24gaXMgZW5hYmxlZFxuICAgICAgICAgICAgICAgIGlmIChjb25maWcuYXV0b0Rlc3Ryb3kpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gbm9pbnNwZWN0aW9uIEpTVW5yZXNvbHZlZEZ1bmN0aW9uXG4gICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBlbGVtZW50cyA9IGZvcmNlZCB8fCBpdGVtcyxcbiAgICAgICAgICAgICAgICBsb2FkVHJpZ2dlcmVkID0gZmFsc2UsXG4gICAgICAgICAgICAgICAgaW1hZ2VCYXNlID0gY29uZmlnLmltYWdlQmFzZSB8fCAnJyxcbiAgICAgICAgICAgICAgICBzcmNzZXRBdHRyaWJ1dGUgPSBjb25maWcuc3Jjc2V0QXR0cmlidXRlLFxuICAgICAgICAgICAgICAgIGhhbmRsZWROYW1lID0gY29uZmlnLmhhbmRsZWROYW1lO1xuXG4gICAgICAgICAgICAvLyBsb29wIGFsbCBhdmFpbGFibGUgaXRlbXNcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZWxlbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAvLyBpdGVtIGlzIGF0IGxlYXN0IGluIGxvYWRhYmxlIGFyZWFcbiAgICAgICAgICAgICAgICBpZiAoYWxsSXRlbXMgfHwgZm9yY2VkIHx8IF9pc0luTG9hZGFibGVBcmVhKGVsZW1lbnRzW2ldKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZWxlbWVudCA9ICQoZWxlbWVudHNbaV0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGFnID0gX2dldEVsZW1lbnRUYWdOYW1lKGVsZW1lbnRzW2ldKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZSA9IGVsZW1lbnQuYXR0cihjb25maWcuYXR0cmlidXRlKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRJbWFnZUJhc2UgPSBlbGVtZW50LmF0dHIoY29uZmlnLmltYWdlQmFzZUF0dHJpYnV0ZSkgfHwgaW1hZ2VCYXNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgY3VzdG9tTG9hZGVyID0gZWxlbWVudC5hdHRyKGNvbmZpZy5sb2FkZXJBdHRyaWJ1dGUpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpcyBub3QgYWxyZWFkeSBoYW5kbGVkIFxuICAgICAgICAgICAgICAgICAgICBpZiAoIWVsZW1lbnQuZGF0YShoYW5kbGVkTmFtZSkgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFuZCBpcyB2aXNpYmxlIG9yIHZpc2liaWxpdHkgZG9lc24ndCBtYXR0ZXJcbiAgICAgICAgICAgICAgICAgICAgICAgICghY29uZmlnLnZpc2libGVPbmx5IHx8IGVsZW1lbnQuaXMoJzp2aXNpYmxlJykpICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFuZCBpbWFnZSBzb3VyY2Ugb3Igc291cmNlIHNldCBhdHRyaWJ1dGUgaXMgYXZhaWxhYmxlXG4gICAgICAgICAgICAgICAgICAgICAgICAoYXR0cmlidXRlIHx8IGVsZW1lbnQuYXR0cihzcmNzZXRBdHRyaWJ1dGUpKSAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5kIGlzIGltYWdlIHRhZyB3aGVyZSBhdHRyaWJ1dGUgaXMgbm90IGVxdWFsIHNvdXJjZSBvciBzb3VyY2Ugc2V0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKHRhZyA9PT0gX2ltZyAmJiAoZWxlbWVudEltYWdlQmFzZSArIGF0dHJpYnV0ZSAhPT0gZWxlbWVudC5hdHRyKF9zcmMpIHx8IGVsZW1lbnQuYXR0cihzcmNzZXRBdHRyaWJ1dGUpICE9PSBlbGVtZW50LmF0dHIoX3NyY3NldCkpKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIG9yIGlzIG5vbiBpbWFnZSB0YWcgd2hlcmUgYXR0cmlidXRlIGlzIG5vdCBlcXVhbCBiYWNrZ3JvdW5kXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKHRhZyAhPT0gX2ltZyAmJiBlbGVtZW50SW1hZ2VCYXNlICsgYXR0cmlidXRlICE9PSBlbGVtZW50LmNzcyhfYmFja2dyb3VuZEltYWdlKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICkgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG9yIGN1c3RvbSBsb2FkZXIgaXMgYXZhaWxhYmxlXG4gICAgICAgICAgICAgICAgICAgICAgICBjdXN0b21Mb2FkZXIpKVxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBtYXJrIGVsZW1lbnQgYWx3YXlzIGFzIGhhbmRsZWQgYXMgdGhpcyBwb2ludCB0byBwcmV2ZW50IGRvdWJsZSBoYW5kbGluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9hZFRyaWdnZXJlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50LmRhdGEoaGFuZGxlZE5hbWUsIHRydWUpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBsb2FkIGl0ZW1cbiAgICAgICAgICAgICAgICAgICAgICAgIF9oYW5kbGVJdGVtKGVsZW1lbnQsIHRhZywgZWxlbWVudEltYWdlQmFzZSwgY3VzdG9tTG9hZGVyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gd2hlbiBzb21ldGhpbmcgd2FzIGxvYWRlZCByZW1vdmUgdGhlbSBmcm9tIHJlbWFpbmluZyBpdGVtc1xuICAgICAgICAgICAgaWYgKGxvYWRUcmlnZ2VyZWQpIHtcbiAgICAgICAgICAgICAgICBpdGVtcyA9ICQoaXRlbXMpLmZpbHRlcihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICEkKHRoaXMpLmRhdGEoaGFuZGxlZE5hbWUpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGxvYWQgdGhlIGdpdmVuIGVsZW1lbnQgdGhlIGxhenkgd2F5XG4gICAgICAgICAqIEBhY2Nlc3MgcHJpdmF0ZVxuICAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gZWxlbWVudFxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gdGFnXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBpbWFnZUJhc2VcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbn0gW2N1c3RvbUxvYWRlcl1cbiAgICAgICAgICogQHJldHVybiB2b2lkXG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBfaGFuZGxlSXRlbShlbGVtZW50LCB0YWcsIGltYWdlQmFzZSwgY3VzdG9tTG9hZGVyKSB7XG4gICAgICAgICAgICAvLyBpbmNyZW1lbnQgY291bnQgb2YgaXRlbXMgd2FpdGluZyBmb3IgYWZ0ZXIgbG9hZFxuICAgICAgICAgICAgKytfYXdhaXRpbmdBZnRlckxvYWQ7XG5cbiAgICAgICAgICAgIC8vIGV4dGVuZGVkIGVycm9yIGNhbGxiYWNrIGZvciBjb3JyZWN0ICdvbkZpbmlzaGVkQWxsJyBoYW5kbGluZ1xuICAgICAgICAgICAgdmFyIGVycm9yQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBfdHJpZ2dlckNhbGxiYWNrKCdvbkVycm9yJywgZWxlbWVudCk7XG4gICAgICAgICAgICAgICAgX3JlZHVjZUF3YWl0aW5nKCk7XG5cbiAgICAgICAgICAgICAgICAvLyBwcmV2ZW50IGZ1cnRoZXIgY2FsbGJhY2sgY2FsbHNcbiAgICAgICAgICAgICAgICBlcnJvckNhbGxiYWNrID0gJC5ub29wO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gdHJpZ2dlciBmdW5jdGlvbiBiZWZvcmUgbG9hZGluZyBpbWFnZVxuICAgICAgICAgICAgX3RyaWdnZXJDYWxsYmFjaygnYmVmb3JlTG9hZCcsIGVsZW1lbnQpO1xuXG4gICAgICAgICAgICAvLyBmZXRjaCBhbGwgZG91YmxlIHVzZWQgZGF0YSBoZXJlIGZvciBiZXR0ZXIgY29kZSBtaW5pbWl6YXRpb25cbiAgICAgICAgICAgIHZhciBzcmNBdHRyaWJ1dGUgPSBjb25maWcuYXR0cmlidXRlLFxuICAgICAgICAgICAgICAgIHNyY3NldEF0dHJpYnV0ZSA9IGNvbmZpZy5zcmNzZXRBdHRyaWJ1dGUsXG4gICAgICAgICAgICAgICAgc2l6ZXNBdHRyaWJ1dGUgPSBjb25maWcuc2l6ZXNBdHRyaWJ1dGUsXG4gICAgICAgICAgICAgICAgcmV0aW5hQXR0cmlidXRlID0gY29uZmlnLnJldGluYUF0dHJpYnV0ZSxcbiAgICAgICAgICAgICAgICByZW1vdmVBdHRyaWJ1dGUgPSBjb25maWcucmVtb3ZlQXR0cmlidXRlLFxuICAgICAgICAgICAgICAgIGxvYWRlZE5hbWUgPSBjb25maWcubG9hZGVkTmFtZSxcbiAgICAgICAgICAgICAgICBlbGVtZW50UmV0aW5hID0gZWxlbWVudC5hdHRyKHJldGluYUF0dHJpYnV0ZSk7XG5cbiAgICAgICAgICAgIC8vIGhhbmRsZSBjdXN0b20gbG9hZGVyXG4gICAgICAgICAgICBpZiAoY3VzdG9tTG9hZGVyKSB7XG4gICAgICAgICAgICAgICAgLy8gb24gbG9hZCBjYWxsYmFja1xuICAgICAgICAgICAgICAgIHZhciBsb2FkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcmVtb3ZlIGF0dHJpYnV0ZSBmcm9tIGVsZW1lbnRcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlbW92ZUF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5yZW1vdmVBdHRyKGNvbmZpZy5sb2FkZXJBdHRyaWJ1dGUpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gbWFyayBlbGVtZW50IGFzIGxvYWRlZFxuICAgICAgICAgICAgICAgICAgICBlbGVtZW50LmRhdGEobG9hZGVkTmFtZSwgdHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gY2FsbCBhZnRlciBsb2FkIGV2ZW50XG4gICAgICAgICAgICAgICAgICAgIF90cmlnZ2VyQ2FsbGJhY2soX2FmdGVyTG9hZCwgZWxlbWVudCk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcmVtb3ZlIGl0ZW0gZnJvbSB3YWl0aW5nIHF1ZXVlIGFuZCBwb3NzaWJseSB0cmlnZ2VyIGZpbmlzaGVkIGV2ZW50XG4gICAgICAgICAgICAgICAgICAgIC8vIGl0J3MgbmVlZGVkIHRvIGJlIGFzeW5jaHJvbm91cyB0byBydW4gYWZ0ZXIgZmlsdGVyIHdhcyBpbiBfbGF6eUxvYWRJdGVtc1xuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KF9yZWR1Y2VBd2FpdGluZywgMSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcHJldmVudCBmdXJ0aGVyIGNhbGxiYWNrIGNhbGxzXG4gICAgICAgICAgICAgICAgICAgIGxvYWRDYWxsYmFjayA9ICQubm9vcDtcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgLy8gYmluZCBlcnJvciBldmVudCB0byB0cmlnZ2VyIGNhbGxiYWNrIGFuZCByZWR1Y2Ugd2FpdGluZyBhbW91bnRcbiAgICAgICAgICAgICAgICBlbGVtZW50Lm9mZihfZXJyb3IpLm9uZShfZXJyb3IsIGVycm9yQ2FsbGJhY2spXG5cbiAgICAgICAgICAgICAgICAvLyBiaW5kIGFmdGVyIGxvYWQgY2FsbGJhY2sgdG8gZWxlbWVudFxuICAgICAgICAgICAgICAgIC5vbmUoX2xvYWQsIGxvYWRDYWxsYmFjayk7XG5cbiAgICAgICAgICAgICAgICAvLyB0cmlnZ2VyIGN1c3RvbSBsb2FkZXIgYW5kIGhhbmRsZSByZXNwb25zZVxuICAgICAgICAgICAgICAgIGlmICghX3RyaWdnZXJDYWxsYmFjayhjdXN0b21Mb2FkZXIsIGVsZW1lbnQsIGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50Lm9mZihfbG9hZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2FkQ2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQub2ZmKF9lcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvckNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KSkge1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50LnRyaWdnZXIoX2Vycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGhhbmRsZSBpbWFnZXNcbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBpbWFnZSBvYmplY3RcbiAgICAgICAgICAgICAgICB2YXIgaW1hZ2VPYmogPSAkKG5ldyBJbWFnZSgpKTtcblxuICAgICAgICAgICAgICAgIC8vIGJpbmQgZXJyb3IgZXZlbnQgdG8gdHJpZ2dlciBjYWxsYmFjayBhbmQgcmVkdWNlIHdhaXRpbmcgYW1vdW50XG4gICAgICAgICAgICAgICAgaW1hZ2VPYmoub25lKF9lcnJvciwgZXJyb3JDYWxsYmFjaylcblxuICAgICAgICAgICAgICAgIC8vIGJpbmQgYWZ0ZXIgbG9hZCBjYWxsYmFjayB0byBpbWFnZVxuICAgICAgICAgICAgICAgIC5vbmUoX2xvYWQsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAvLyByZW1vdmUgZWxlbWVudCBmcm9tIHZpZXdcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5oaWRlKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gc2V0IGltYWdlIGJhY2sgdG8gZWxlbWVudFxuICAgICAgICAgICAgICAgICAgICAvLyBkbyBpdCBhcyBzaW5nbGUgJ2F0dHInIGNhbGxzLCB0byBiZSBzdXJlICdzcmMnIGlzIHNldCBhZnRlciAnc3Jjc2V0J1xuICAgICAgICAgICAgICAgICAgICBpZiAodGFnID09PSBfaW1nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50LmF0dHIoX3NpemVzLCBpbWFnZU9iai5hdHRyKF9zaXplcykpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoX3NyY3NldCwgaW1hZ2VPYmouYXR0cihfc3Jjc2V0KSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cihfc3JjLCBpbWFnZU9iai5hdHRyKF9zcmMpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuY3NzKF9iYWNrZ3JvdW5kSW1hZ2UsIFwidXJsKCdcIiArIGltYWdlT2JqLmF0dHIoX3NyYykgKyBcIicpXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYnJpbmcgaXQgYmFjayB3aXRoIHNvbWUgZWZmZWN0IVxuICAgICAgICAgICAgICAgICAgICBlbGVtZW50W2NvbmZpZy5lZmZlY3RdKGNvbmZpZy5lZmZlY3RUaW1lKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyByZW1vdmUgYXR0cmlidXRlIGZyb20gZWxlbWVudFxuICAgICAgICAgICAgICAgICAgICBpZiAocmVtb3ZlQXR0cmlidXRlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50LnJlbW92ZUF0dHIoc3JjQXR0cmlidXRlICsgJyAnICsgc3Jjc2V0QXR0cmlidXRlICsgJyAnICsgcmV0aW5hQXR0cmlidXRlICsgJyAnICsgY29uZmlnLmltYWdlQmFzZUF0dHJpYnV0ZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG9ubHkgcmVtb3ZlICdzaXplcycgYXR0cmlidXRlLCBpZiBpdCB3YXMgYSBjdXN0b20gb25lXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2l6ZXNBdHRyaWJ1dGUgIT09IF9zaXplcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQucmVtb3ZlQXR0cihzaXplc0F0dHJpYnV0ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBtYXJrIGVsZW1lbnQgYXMgbG9hZGVkXG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuZGF0YShsb2FkZWROYW1lLCB0cnVlKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBjYWxsIGFmdGVyIGxvYWQgZXZlbnRcbiAgICAgICAgICAgICAgICAgICAgX3RyaWdnZXJDYWxsYmFjayhfYWZ0ZXJMb2FkLCBlbGVtZW50KTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBjbGVhbnVwIGltYWdlIG9iamVjdFxuICAgICAgICAgICAgICAgICAgICBpbWFnZU9iai5yZW1vdmUoKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyByZW1vdmUgaXRlbSBmcm9tIHdhaXRpbmcgcXVldWUgYW5kIHBvc3NpYmx5IHRyaWdnZXIgZmluaXNoZWQgZXZlbnRcbiAgICAgICAgICAgICAgICAgICAgX3JlZHVjZUF3YWl0aW5nKCk7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgc291cmNlc1xuICAgICAgICAgICAgICAgIC8vIGRvIGl0IGFzIHNpbmdsZSAnYXR0cicgY2FsbHMsIHRvIGJlIHN1cmUgJ3NyYycgaXMgc2V0IGFmdGVyICdzcmNzZXQnXG4gICAgICAgICAgICAgICAgdmFyIGltYWdlU3JjID0gKF9pc1JldGluYURpc3BsYXkgJiYgZWxlbWVudFJldGluYSA/IGVsZW1lbnRSZXRpbmEgOiBlbGVtZW50LmF0dHIoc3JjQXR0cmlidXRlKSkgfHwgJyc7XG4gICAgICAgICAgICAgICAgaW1hZ2VPYmouYXR0cihfc2l6ZXMsIGVsZW1lbnQuYXR0cihzaXplc0F0dHJpYnV0ZSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cihfc3Jjc2V0LCBlbGVtZW50LmF0dHIoc3Jjc2V0QXR0cmlidXRlKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKF9zcmMsIGltYWdlU3JjID8gaW1hZ2VCYXNlICsgaW1hZ2VTcmMgOiBudWxsKTtcblxuICAgICAgICAgICAgICAgIC8vIGNhbGwgYWZ0ZXIgbG9hZCBldmVuIG9uIGNhY2hlZCBpbWFnZVxuICAgICAgICAgICAgICAgIGltYWdlT2JqLmNvbXBsZXRlICYmIGltYWdlT2JqLnRyaWdnZXIoX2xvYWQpOyAvLyBqc2hpbnQgaWdub3JlIDogbGluZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGNoZWNrIGlmIHRoZSBnaXZlbiBlbGVtZW50IGlzIGluc2lkZSB0aGUgY3VycmVudCB2aWV3cG9ydCBvciB0aHJlc2hvbGRcbiAgICAgICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBlbGVtZW50XG4gICAgICAgICAqIEByZXR1cm4ge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBfaXNJbkxvYWRhYmxlQXJlYShlbGVtZW50KSB7XG4gICAgICAgICAgICB2YXIgZWxlbWVudEJvdW5kID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSxcbiAgICAgICAgICAgICAgICBkaXJlY3Rpb24gICAgPSBjb25maWcuc2Nyb2xsRGlyZWN0aW9uLFxuICAgICAgICAgICAgICAgIHRocmVzaG9sZCAgICA9IGNvbmZpZy50aHJlc2hvbGQsXG4gICAgICAgICAgICAgICAgdmVydGljYWwgICAgID0gLy8gY2hlY2sgaWYgZWxlbWVudCBpcyBpbiBsb2FkYWJsZSBhcmVhIGZyb20gdG9wXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKChfZ2V0QWN0dWFsSGVpZ2h0KCkgKyB0aHJlc2hvbGQpID4gZWxlbWVudEJvdW5kLnRvcCkgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjaGVjayBpZiBlbGVtZW50IGlzIGV2ZW4gaW4gbG9hZGFibGUgYXJlIGZyb20gYm90dG9tXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKC10aHJlc2hvbGQgPCBlbGVtZW50Qm91bmQuYm90dG9tKSxcbiAgICAgICAgICAgICAgICBob3Jpem9udGFsICAgPSAvLyBjaGVjayBpZiBlbGVtZW50IGlzIGluIGxvYWRhYmxlIGFyZWEgZnJvbSBsZWZ0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKChfZ2V0QWN0dWFsV2lkdGgoKSArIHRocmVzaG9sZCkgPiBlbGVtZW50Qm91bmQubGVmdCkgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjaGVjayBpZiBlbGVtZW50IGlzIGV2ZW4gaW4gbG9hZGFibGUgYXJlYSBmcm9tIHJpZ2h0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKC10aHJlc2hvbGQgPCBlbGVtZW50Qm91bmQucmlnaHQpO1xuXG4gICAgICAgICAgICBpZiAoZGlyZWN0aW9uID09PSAndmVydGljYWwnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHZlcnRpY2FsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGlyZWN0aW9uID09PSAnaG9yaXpvbnRhbCcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaG9yaXpvbnRhbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHZlcnRpY2FsICYmIGhvcml6b250YWw7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogcmVjZWl2ZSB0aGUgY3VycmVudCB2aWV3ZWQgd2lkdGggb2YgdGhlIGJyb3dzZXJcbiAgICAgICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICAgICAqIEByZXR1cm4ge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIF9nZXRBY3R1YWxXaWR0aCgpIHtcbiAgICAgICAgICAgIHJldHVybiBfYWN0dWFsV2lkdGggPj0gMCA/IF9hY3R1YWxXaWR0aCA6IChfYWN0dWFsV2lkdGggPSAkKHdpbmRvdykud2lkdGgoKSk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogcmVjZWl2ZSB0aGUgY3VycmVudCB2aWV3ZWQgaGVpZ2h0IG9mIHRoZSBicm93c2VyXG4gICAgICAgICAqIEBhY2Nlc3MgcHJpdmF0ZVxuICAgICAgICAgKiBAcmV0dXJuIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBfZ2V0QWN0dWFsSGVpZ2h0KCkge1xuICAgICAgICAgICAgcmV0dXJuIF9hY3R1YWxIZWlnaHQgPj0gMCA/IF9hY3R1YWxIZWlnaHQgOiAoX2FjdHVhbEhlaWdodCA9ICQod2luZG93KS5oZWlnaHQoKSk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogZ2V0IGxvd2VyY2FzZSB0YWcgbmFtZSBvZiBhbiBlbGVtZW50XG4gICAgICAgICAqIEBhY2Nlc3MgcHJpdmF0ZVxuICAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gZWxlbWVudFxuICAgICAgICAgKiBAcmV0dXJucyB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gX2dldEVsZW1lbnRUYWdOYW1lKGVsZW1lbnQpIHtcbiAgICAgICAgICAgIHJldHVybiBlbGVtZW50LnRhZ05hbWUudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBwcmVwZW5kIGltYWdlIGJhc2UgdG8gYWxsIHNyY3NldCBlbnRyaWVzXG4gICAgICAgICAqIEBhY2Nlc3MgcHJpdmF0ZVxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3Jjc2V0XG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBpbWFnZUJhc2VcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIF9nZXRDb3JyZWN0ZWRTcmNTZXQoc3Jjc2V0LCBpbWFnZUJhc2UpIHtcbiAgICAgICAgICAgIGlmIChpbWFnZUJhc2UpIHtcbiAgICAgICAgICAgICAgICAvLyB0cmltLCByZW1vdmUgdW5uZWNlc3Nhcnkgc3BhY2VzIGFuZCBzcGxpdCBlbnRyaWVzXG4gICAgICAgICAgICAgICAgdmFyIGVudHJpZXMgPSBzcmNzZXQuc3BsaXQoJywnKTtcbiAgICAgICAgICAgICAgICBzcmNzZXQgPSAnJztcblxuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gZW50cmllcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgc3Jjc2V0ICs9IGltYWdlQmFzZSArIGVudHJpZXNbaV0udHJpbSgpICsgKGkgIT09IGwgLSAxID8gJywnIDogJycpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHNyY3NldDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBoZWxwZXIgZnVuY3Rpb24gdG8gdGhyb3R0bGUgZG93biBldmVudCB0cmlnZ2VyaW5nXG4gICAgICAgICAqIEBhY2Nlc3MgcHJpdmF0ZVxuICAgICAgICAgKiBAcGFyYW0ge251bWJlcn0gZGVsYXlcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2tcbiAgICAgICAgICogQHJldHVybiB7ZnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBfdGhyb3R0bGUoZGVsYXksIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICB2YXIgdGltZW91dCxcbiAgICAgICAgICAgICAgICBsYXN0RXhlY3V0ZSA9IDA7XG5cbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihldmVudCwgaWdub3JlVGhyb3R0bGUpIHtcbiAgICAgICAgICAgICAgICB2YXIgZWxhcHNlZCA9ICtuZXcgRGF0ZSgpIC0gbGFzdEV4ZWN1dGU7XG5cbiAgICAgICAgICAgICAgICBmdW5jdGlvbiBydW4oKSB7XG4gICAgICAgICAgICAgICAgICAgIGxhc3RFeGVjdXRlID0gK25ldyBEYXRlKCk7XG4gICAgICAgICAgICAgICAgICAgIC8vIG5vaW5zcGVjdGlvbiBKU1VucmVzb2x2ZWRGdW5jdGlvblxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjay5jYWxsKGluc3RhbmNlLCBldmVudCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGltZW91dCAmJiBjbGVhclRpbWVvdXQodGltZW91dCk7IC8vIGpzaGludCBpZ25vcmUgOiBsaW5lXG5cbiAgICAgICAgICAgICAgICBpZiAoZWxhcHNlZCA+IGRlbGF5IHx8ICFjb25maWcuZW5hYmxlVGhyb3R0bGUgfHwgaWdub3JlVGhyb3R0bGUpIHtcbiAgICAgICAgICAgICAgICAgICAgcnVuKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0ID0gc2V0VGltZW91dChydW4sIGRlbGF5IC0gZWxhcHNlZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiByZWR1Y2UgY291bnQgb2YgYXdhaXRpbmcgZWxlbWVudHMgdG8gJ2FmdGVyTG9hZCcgZXZlbnQgYW5kIGZpcmUgJ29uRmluaXNoZWRBbGwnIGlmIHJlYWNoZWQgemVyb1xuICAgICAgICAgKiBAYWNjZXNzIHByaXZhdGVcbiAgICAgICAgICogQHJldHVybiB2b2lkXG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBfcmVkdWNlQXdhaXRpbmcoKSB7XG4gICAgICAgICAgICAtLV9hd2FpdGluZ0FmdGVyTG9hZDtcblxuICAgICAgICAgICAgLy8gaWYgbm8gaXRlbXMgd2VyZSBsZWZ0IHRyaWdnZXIgZmluaXNoZWQgZXZlbnRcbiAgICAgICAgICAgIGlmICghaXRlbXMubGVuZ3RoICYmICFfYXdhaXRpbmdBZnRlckxvYWQpIHtcbiAgICAgICAgICAgICAgICBfdHJpZ2dlckNhbGxiYWNrKCdvbkZpbmlzaGVkQWxsJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogc2luZ2xlIGltcGxlbWVudGF0aW9uIHRvIGhhbmRsZSBjYWxsYmFja3MsIHBhc3MgZWxlbWVudCBhbmQgc2V0ICd0aGlzJyB0byBjdXJyZW50IGluc3RhbmNlXG4gICAgICAgICAqIEBhY2Nlc3MgcHJpdmF0ZVxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ3xmdW5jdGlvbn0gY2FsbGJhY2tcbiAgICAgICAgICogQHBhcmFtIHtvYmplY3R9IFtlbGVtZW50XVxuICAgICAgICAgKiBAcGFyYW0geyp9IFthcmdzXVxuICAgICAgICAgKiBAcmV0dXJuIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gX3RyaWdnZXJDYWxsYmFjayhjYWxsYmFjaywgZWxlbWVudCwgYXJncykge1xuICAgICAgICAgICAgaWYgKChjYWxsYmFjayA9IGNvbmZpZ1tjYWxsYmFja10pKSB7XG4gICAgICAgICAgICAgICAgLy8galF1ZXJ5J3MgaW50ZXJuYWwgJyQoYXJndW1lbnRzKS5zbGljZSgxKScgYXJlIGNhdXNpbmcgcHJvYmxlbXMgYXQgbGVhc3Qgb24gb2xkIGlQYWRzXG4gICAgICAgICAgICAgICAgLy8gYmVsb3cgaXMgc2hvcnRoYW5kIG9mICdBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpJ1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KGluc3RhbmNlLCBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiBldmVudCBkcml2ZW4gb3Igd2luZG93IGlzIGFscmVhZHkgbG9hZGVkIGRvbid0IHdhaXQgZm9yIHBhZ2UgbG9hZGluZ1xuICAgICAgICBpZiAoY29uZmlnLmJpbmQgPT09ICdldmVudCcgfHwgd2luZG93TG9hZGVkKSB7XG4gICAgICAgICAgICBfaW5pdGlhbGl6ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gb3RoZXJ3aXNlIGxvYWQgaW5pdGlhbCBpdGVtcyBhbmQgc3RhcnQgbGF6eSBhZnRlciBwYWdlIGxvYWRcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvLyBub2luc3BlY3Rpb24gSlNVbnJlc29sdmVkVmFyaWFibGVcbiAgICAgICAgICAgICQod2luZG93KS5vbihfbG9hZCArICcuJyArIG5hbWVzcGFjZSwgX2luaXRpYWxpemUpO1xuICAgICAgICB9ICBcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBsYXp5IHBsdWdpbiBjbGFzcyBjb25zdHJ1Y3RvclxuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqIEBhY2Nlc3MgcHJpdmF0ZVxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBlbGVtZW50c1xuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBzZXR0aW5nc1xuICAgICAqIEByZXR1cm4ge29iamVjdHxMYXp5UGx1Z2lufVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIExhenlQbHVnaW4oZWxlbWVudHMsIHNldHRpbmdzKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiB0aGlzIGxhenkgcGx1Z2luIGluc3RhbmNlXG4gICAgICAgICAqIEBhY2Nlc3MgcHJpdmF0ZVxuICAgICAgICAgKiBAdHlwZSB7b2JqZWN0fExhenlQbHVnaW58TGF6eVBsdWdpbi5wcm90b3R5cGV9XG4gICAgICAgICAqL1xuICAgICAgICB2YXIgX2luc3RhbmNlID0gdGhpcyxcblxuICAgICAgICAvKipcbiAgICAgICAgICogdGhpcyBsYXp5IHBsdWdpbiBpbnN0YW5jZSBjb25maWd1cmF0aW9uXG4gICAgICAgICAqIEBhY2Nlc3MgcHJpdmF0ZVxuICAgICAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgX2NvbmZpZyA9ICQuZXh0ZW5kKHt9LCBfaW5zdGFuY2UuY29uZmlnLCBzZXR0aW5ncyksXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGluc3RhbmNlIGdlbmVyYXRlZCBldmVudCBleGVjdXRlZCBvbiBjb250YWluZXIgc2Nyb2xsIG9yIHJlc2l6ZVxuICAgICAgICAgKiBwYWNrZWQgaW4gYW4gb2JqZWN0IHRvIGJlIHJlZmVyZW5jZWFibGUgYW5kIHNob3J0IG5hbWVkIGJlY2F1c2UgcHJvcGVydGllcyB3aWxsIG5vdCBiZSBtaW5pZmllZFxuICAgICAgICAgKiBAYWNjZXNzIHByaXZhdGVcbiAgICAgICAgICogQHR5cGUge29iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIF9ldmVudHMgPSB7fSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogdW5pcXVlIG5hbWVzcGFjZSBmb3IgaW5zdGFuY2UgcmVsYXRlZCBldmVudHNcbiAgICAgICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICBfbmFtZXNwYWNlID0gX2NvbmZpZy5uYW1lICsgJy0nICsgKCsrbGF6eUluc3RhbmNlSWQpO1xuXG4gICAgICAgIC8vIG5vaW5zcGVjdGlvbiBKU1VuZGVmaW5lZFByb3BlcnR5QXNzaWdubWVudFxuICAgICAgICAvKipcbiAgICAgICAgICogd3JhcHBlciB0byBnZXQgb3Igc2V0IGFuIGVudHJ5IGZyb20gcGx1Z2luIGluc3RhbmNlIGNvbmZpZ3VyYXRpb25cbiAgICAgICAgICogbXVjaCBzbWFsbGVyIG9uIG1pbmlmeSBhcyBkaXJlY3QgYWNjZXNzXG4gICAgICAgICAqIEBhY2Nlc3MgcHVibGljXG4gICAgICAgICAqIEB0eXBlIHtmdW5jdGlvbn1cbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGVudHJ5TmFtZVxuICAgICAgICAgKiBAcGFyYW0geyp9IFt2YWx1ZV1cbiAgICAgICAgICogQHJldHVybiB7TGF6eVBsdWdpbnwqfVxuICAgICAgICAgKi9cbiAgICAgICAgX2luc3RhbmNlLmNvbmZpZyA9IGZ1bmN0aW9uKGVudHJ5TmFtZSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIF9jb25maWdbZW50cnlOYW1lXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgX2NvbmZpZ1tlbnRyeU5hbWVdID0gdmFsdWU7XG4gICAgICAgICAgICByZXR1cm4gX2luc3RhbmNlO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIG5vaW5zcGVjdGlvbiBKU1VuZGVmaW5lZFByb3BlcnR5QXNzaWdubWVudFxuICAgICAgICAvKipcbiAgICAgICAgICogYWRkIGFkZGl0aW9uYWwgaXRlbXMgdG8gY3VycmVudCBpbnN0YW5jZVxuICAgICAgICAgKiBAYWNjZXNzIHB1YmxpY1xuICAgICAgICAgKiBAcGFyYW0ge0FycmF5fG9iamVjdHxzdHJpbmd9IGl0ZW1zXG4gICAgICAgICAqIEByZXR1cm4ge0xhenlQbHVnaW59XG4gICAgICAgICAqL1xuICAgICAgICBfaW5zdGFuY2UuYWRkSXRlbXMgPSBmdW5jdGlvbihpdGVtcykge1xuICAgICAgICAgICAgX2V2ZW50cy5hICYmIF9ldmVudHMuYSgkLnR5cGUoaXRlbXMpID09PSAnc3RyaW5nJyA/ICQoaXRlbXMpIDogaXRlbXMpOyAvLyBqc2hpbnQgaWdub3JlIDogbGluZVxuICAgICAgICAgICAgcmV0dXJuIF9pbnN0YW5jZTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBub2luc3BlY3Rpb24gSlNVbmRlZmluZWRQcm9wZXJ0eUFzc2lnbm1lbnRcbiAgICAgICAgLyoqXG4gICAgICAgICAqIGdldCBhbGwgbGVmdCBpdGVtcyBvZiB0aGlzIGluc3RhbmNlXG4gICAgICAgICAqIEBhY2Nlc3MgcHVibGljXG4gICAgICAgICAqIEByZXR1cm5zIHtvYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBfaW5zdGFuY2UuZ2V0SXRlbXMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBfZXZlbnRzLmcgPyBfZXZlbnRzLmcoKSA6IHt9O1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIG5vaW5zcGVjdGlvbiBKU1VuZGVmaW5lZFByb3BlcnR5QXNzaWdubWVudFxuICAgICAgICAvKipcbiAgICAgICAgICogZm9yY2UgbGF6eSB0byBsb2FkIGFsbCBpdGVtcyBpbiBsb2FkYWJsZSBhcmVhIHJpZ2h0IG5vd1xuICAgICAgICAgKiBieSBkZWZhdWx0IHdpdGhvdXQgdGhyb3R0bGVcbiAgICAgICAgICogQGFjY2VzcyBwdWJsaWNcbiAgICAgICAgICogQHR5cGUge2Z1bmN0aW9ufVxuICAgICAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFt1c2VUaHJvdHRsZV1cbiAgICAgICAgICogQHJldHVybiB7TGF6eVBsdWdpbn1cbiAgICAgICAgICovXG4gICAgICAgIF9pbnN0YW5jZS51cGRhdGUgPSBmdW5jdGlvbih1c2VUaHJvdHRsZSkge1xuICAgICAgICAgICAgX2V2ZW50cy5lICYmIF9ldmVudHMuZSh7fSwgIXVzZVRocm90dGxlKTsgLy8ganNoaW50IGlnbm9yZSA6IGxpbmVcbiAgICAgICAgICAgIHJldHVybiBfaW5zdGFuY2U7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gbm9pbnNwZWN0aW9uIEpTVW5kZWZpbmVkUHJvcGVydHlBc3NpZ25tZW50XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBmb3JjZSBlbGVtZW50KHMpIHRvIGxvYWQgZGlyZWN0bHksIGlnbm9yaW5nIHRoZSB2aWV3cG9ydFxuICAgICAgICAgKiBAYWNjZXNzIHB1YmxpY1xuICAgICAgICAgKiBAcGFyYW0ge0FycmF5fG9iamVjdHxzdHJpbmd9IGl0ZW1zXG4gICAgICAgICAqIEByZXR1cm4ge0xhenlQbHVnaW59XG4gICAgICAgICAqL1xuICAgICAgICBfaW5zdGFuY2UuZm9yY2UgPSBmdW5jdGlvbihpdGVtcykge1xuICAgICAgICAgICAgX2V2ZW50cy5mICYmIF9ldmVudHMuZigkLnR5cGUoaXRlbXMpID09PSAnc3RyaW5nJyA/ICQoaXRlbXMpIDogaXRlbXMpOyAvLyBqc2hpbnQgaWdub3JlIDogbGluZVxuICAgICAgICAgICAgcmV0dXJuIF9pbnN0YW5jZTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBub2luc3BlY3Rpb24gSlNVbmRlZmluZWRQcm9wZXJ0eUFzc2lnbm1lbnRcbiAgICAgICAgLyoqXG4gICAgICAgICAqIGZvcmNlIGxhenkgdG8gbG9hZCBhbGwgYXZhaWxhYmxlIGl0ZW1zIHJpZ2h0IG5vd1xuICAgICAgICAgKiB0aGlzIGNhbGwgaWdub3JlcyB0aHJvdHRsaW5nXG4gICAgICAgICAqIEBhY2Nlc3MgcHVibGljXG4gICAgICAgICAqIEB0eXBlIHtmdW5jdGlvbn1cbiAgICAgICAgICogQHJldHVybiB7TGF6eVBsdWdpbn1cbiAgICAgICAgICovXG4gICAgICAgIF9pbnN0YW5jZS5sb2FkQWxsID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBfZXZlbnRzLmUgJiYgX2V2ZW50cy5lKHthbGw6IHRydWV9LCB0cnVlKTsgLy8ganNoaW50IGlnbm9yZSA6IGxpbmVcbiAgICAgICAgICAgIHJldHVybiBfaW5zdGFuY2U7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gbm9pbnNwZWN0aW9uIEpTVW5kZWZpbmVkUHJvcGVydHlBc3NpZ25tZW50XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBkZXN0cm95IHRoaXMgcGx1Z2luIGluc3RhbmNlXG4gICAgICAgICAqIEBhY2Nlc3MgcHVibGljXG4gICAgICAgICAqIEB0eXBlIHtmdW5jdGlvbn1cbiAgICAgICAgICogQHJldHVybiB1bmRlZmluZWRcbiAgICAgICAgICovXG4gICAgICAgIF9pbnN0YW5jZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAvLyB1bmJpbmQgaW5zdGFuY2UgZ2VuZXJhdGVkIGV2ZW50c1xuICAgICAgICAgICAgLy8gbm9pbnNwZWN0aW9uIEpTVW5yZXNvbHZlZEZ1bmN0aW9uLCBKU1VucmVzb2x2ZWRWYXJpYWJsZVxuICAgICAgICAgICAgJChfY29uZmlnLmFwcGVuZFNjcm9sbCkub2ZmKCcuJyArIF9uYW1lc3BhY2UsIF9ldmVudHMuZSk7XG4gICAgICAgICAgICAvLyBub2luc3BlY3Rpb24gSlNVbnJlc29sdmVkVmFyaWFibGVcbiAgICAgICAgICAgICQod2luZG93KS5vZmYoJy4nICsgX25hbWVzcGFjZSk7XG5cbiAgICAgICAgICAgIC8vIGNsZWFyIGV2ZW50c1xuICAgICAgICAgICAgX2V2ZW50cyA9IHt9O1xuXG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIHN0YXJ0IHVzaW5nIGxhenkgYW5kIHJldHVybiBhbGwgZWxlbWVudHMgdG8gYmUgY2hhaW5hYmxlIG9yIGluc3RhbmNlIGZvciBmdXJ0aGVyIHVzZVxuICAgICAgICAvLyBub2luc3BlY3Rpb24gSlNVbnJlc29sdmVkVmFyaWFibGVcbiAgICAgICAgX2V4ZWN1dGVMYXp5KF9pbnN0YW5jZSwgX2NvbmZpZywgZWxlbWVudHMsIF9ldmVudHMsIF9uYW1lc3BhY2UpO1xuICAgICAgICByZXR1cm4gX2NvbmZpZy5jaGFpbmFibGUgPyBlbGVtZW50cyA6IF9pbnN0YW5jZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBzZXR0aW5ncyBhbmQgY29uZmlndXJhdGlvbiBkYXRhXG4gICAgICogQGFjY2VzcyBwdWJsaWNcbiAgICAgKiBAdHlwZSB7b2JqZWN0fCp9XG4gICAgICovXG4gICAgTGF6eVBsdWdpbi5wcm90b3R5cGUuY29uZmlnID0ge1xuICAgICAgICAvLyBnZW5lcmFsXG4gICAgICAgIG5hbWUgICAgICAgICAgICAgICA6ICdsYXp5JyxcbiAgICAgICAgY2hhaW5hYmxlICAgICAgICAgIDogdHJ1ZSxcbiAgICAgICAgYXV0b0Rlc3Ryb3kgICAgICAgIDogdHJ1ZSxcbiAgICAgICAgYmluZCAgICAgICAgICAgICAgIDogJ2xvYWQnLFxuICAgICAgICB0aHJlc2hvbGQgICAgICAgICAgOiA1MDAsXG4gICAgICAgIHZpc2libGVPbmx5ICAgICAgICA6IGZhbHNlLFxuICAgICAgICBhcHBlbmRTY3JvbGwgICAgICAgOiB3aW5kb3csXG4gICAgICAgIHNjcm9sbERpcmVjdGlvbiAgICA6ICdib3RoJyxcbiAgICAgICAgaW1hZ2VCYXNlICAgICAgICAgIDogbnVsbCxcbiAgICAgICAgZGVmYXVsdEltYWdlICAgICAgIDogJ2RhdGE6aW1hZ2UvZ2lmO2Jhc2U2NCxSMGxHT0RsaEFRQUJBSUFBQVAvLy93QUFBQ0g1QkFFQUFBQUFMQUFBQUFBQkFBRUFBQUlDUkFFQU93PT0nLFxuICAgICAgICBwbGFjZWhvbGRlciAgICAgICAgOiBudWxsLFxuICAgICAgICBkZWxheSAgICAgICAgICAgICAgOiAtMSxcbiAgICAgICAgY29tYmluZWQgICAgICAgICAgIDogZmFsc2UsXG5cbiAgICAgICAgLy8gYXR0cmlidXRlc1xuICAgICAgICBhdHRyaWJ1dGUgICAgICAgICAgOiAnZGF0YS1zcmMnLFxuICAgICAgICBzcmNzZXRBdHRyaWJ1dGUgICAgOiAnZGF0YS1zcmNzZXQnLFxuICAgICAgICBzaXplc0F0dHJpYnV0ZSAgICAgOiAnZGF0YS1zaXplcycsXG4gICAgICAgIHJldGluYUF0dHJpYnV0ZSAgICA6ICdkYXRhLXJldGluYScsXG4gICAgICAgIGxvYWRlckF0dHJpYnV0ZSAgICA6ICdkYXRhLWxvYWRlcicsXG4gICAgICAgIGltYWdlQmFzZUF0dHJpYnV0ZSA6ICdkYXRhLWltYWdlYmFzZScsXG4gICAgICAgIHJlbW92ZUF0dHJpYnV0ZSAgICA6IHRydWUsXG4gICAgICAgIGhhbmRsZWROYW1lICAgICAgICA6ICdoYW5kbGVkJyxcbiAgICAgICAgbG9hZGVkTmFtZSAgICAgICAgIDogJ2xvYWRlZCcsXG5cbiAgICAgICAgLy8gZWZmZWN0XG4gICAgICAgIGVmZmVjdCAgICAgICAgICAgICA6ICdzaG93JyxcbiAgICAgICAgZWZmZWN0VGltZSAgICAgICAgIDogMCxcblxuICAgICAgICAvLyB0aHJvdHRsZVxuICAgICAgICBlbmFibGVUaHJvdHRsZSAgICAgOiB0cnVlLFxuICAgICAgICB0aHJvdHRsZSAgICAgICAgICAgOiAyNTAsXG5cbiAgICAgICAgLy8gY2FsbGJhY2tzXG4gICAgICAgIGJlZm9yZUxvYWQgICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgICAgYWZ0ZXJMb2FkICAgICAgICAgIDogdW5kZWZpbmVkLFxuICAgICAgICBvbkVycm9yICAgICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAgIG9uRmluaXNoZWRBbGwgICAgICA6IHVuZGVmaW5lZFxuICAgIH07XG5cbiAgICAvLyByZWdpc3RlciB3aW5kb3cgbG9hZCBldmVudCBnbG9iYWxseSB0byBwcmV2ZW50IG5vdCBsb2FkaW5nIGVsZW1lbnRzXG4gICAgLy8gc2luY2UgalF1ZXJ5IDMuWCByZWFkeSBzdGF0ZSBpcyBmdWxseSBhc3luYyBhbmQgbWF5IGJlIGV4ZWN1dGVkIGFmdGVyICdsb2FkJyBcbiAgICAkKHdpbmRvdykub24oJ2xvYWQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgd2luZG93TG9hZGVkID0gdHJ1ZTtcbiAgICB9KTtcbn0pKHdpbmRvdyk7IiwiLyohIGpRdWVyeSAmIFplcHRvIExhenkgdjEuNy4xMCAtIGh0dHA6Ly9qcXVlcnkuZWlzYmVoci5kZS9sYXp5IC0gTUlUJkdQTC0yLjAgbGljZW5zZSAtIENvcHlyaWdodCAyMDEyLTIwMTggRGFuaWVsICdFaXNiZWhyJyBLZXJuICovXG4hZnVuY3Rpb24odCxlKXtcInVzZSBzdHJpY3RcIjtmdW5jdGlvbiByKHIsYSxpLHUsbCl7ZnVuY3Rpb24gZigpe0w9dC5kZXZpY2VQaXhlbFJhdGlvPjEsaT1jKGkpLGEuZGVsYXk+PTAmJnNldFRpbWVvdXQoZnVuY3Rpb24oKXtzKCEwKX0sYS5kZWxheSksKGEuZGVsYXk8MHx8YS5jb21iaW5lZCkmJih1LmU9dihhLnRocm90dGxlLGZ1bmN0aW9uKHQpe1wicmVzaXplXCI9PT10LnR5cGUmJih3PUI9LTEpLHModC5hbGwpfSksdS5hPWZ1bmN0aW9uKHQpe3Q9Yyh0KSxpLnB1c2guYXBwbHkoaSx0KX0sdS5nPWZ1bmN0aW9uKCl7cmV0dXJuIGk9bihpKS5maWx0ZXIoZnVuY3Rpb24oKXtyZXR1cm4hbih0aGlzKS5kYXRhKGEubG9hZGVkTmFtZSl9KX0sdS5mPWZ1bmN0aW9uKHQpe2Zvcih2YXIgZT0wO2U8dC5sZW5ndGg7ZSsrKXt2YXIgcj1pLmZpbHRlcihmdW5jdGlvbigpe3JldHVybiB0aGlzPT09dFtlXX0pO3IubGVuZ3RoJiZzKCExLHIpfX0scygpLG4oYS5hcHBlbmRTY3JvbGwpLm9uKFwic2Nyb2xsLlwiK2wrXCIgcmVzaXplLlwiK2wsdS5lKSl9ZnVuY3Rpb24gYyh0KXt2YXIgaT1hLmRlZmF1bHRJbWFnZSxvPWEucGxhY2Vob2xkZXIsdT1hLmltYWdlQmFzZSxsPWEuc3Jjc2V0QXR0cmlidXRlLGY9YS5sb2FkZXJBdHRyaWJ1dGUsYz1hLl9mfHx7fTt0PW4odCkuZmlsdGVyKGZ1bmN0aW9uKCl7dmFyIHQ9bih0aGlzKSxyPW0odGhpcyk7cmV0dXJuIXQuZGF0YShhLmhhbmRsZWROYW1lKSYmKHQuYXR0cihhLmF0dHJpYnV0ZSl8fHQuYXR0cihsKXx8dC5hdHRyKGYpfHxjW3JdIT09ZSl9KS5kYXRhKFwicGx1Z2luX1wiK2EubmFtZSxyKTtmb3IodmFyIHM9MCxkPXQubGVuZ3RoO3M8ZDtzKyspe3ZhciBBPW4odFtzXSksZz1tKHRbc10pLGg9QS5hdHRyKGEuaW1hZ2VCYXNlQXR0cmlidXRlKXx8dTtnPT09TiYmaCYmQS5hdHRyKGwpJiZBLmF0dHIobCxiKEEuYXR0cihsKSxoKSksY1tnXT09PWV8fEEuYXR0cihmKXx8QS5hdHRyKGYsY1tnXSksZz09PU4mJmkmJiFBLmF0dHIoRSk/QS5hdHRyKEUsaSk6Zz09PU58fCFvfHxBLmNzcyhPKSYmXCJub25lXCIhPT1BLmNzcyhPKXx8QS5jc3MoTyxcInVybCgnXCIrbytcIicpXCIpfXJldHVybiB0fWZ1bmN0aW9uIHModCxlKXtpZighaS5sZW5ndGgpcmV0dXJuIHZvaWQoYS5hdXRvRGVzdHJveSYmci5kZXN0cm95KCkpO2Zvcih2YXIgbz1lfHxpLHU9ITEsbD1hLmltYWdlQmFzZXx8XCJcIixmPWEuc3Jjc2V0QXR0cmlidXRlLGM9YS5oYW5kbGVkTmFtZSxzPTA7czxvLmxlbmd0aDtzKyspaWYodHx8ZXx8QShvW3NdKSl7dmFyIGc9bihvW3NdKSxoPW0ob1tzXSksYj1nLmF0dHIoYS5hdHRyaWJ1dGUpLHY9Zy5hdHRyKGEuaW1hZ2VCYXNlQXR0cmlidXRlKXx8bCxwPWcuYXR0cihhLmxvYWRlckF0dHJpYnV0ZSk7Zy5kYXRhKGMpfHxhLnZpc2libGVPbmx5JiYhZy5pcyhcIjp2aXNpYmxlXCIpfHwhKChifHxnLmF0dHIoZikpJiYoaD09PU4mJih2K2IhPT1nLmF0dHIoRSl8fGcuYXR0cihmKSE9PWcuYXR0cihGKSl8fGghPT1OJiZ2K2IhPT1nLmNzcyhPKSl8fHApfHwodT0hMCxnLmRhdGEoYywhMCksZChnLGgsdixwKSl9dSYmKGk9bihpKS5maWx0ZXIoZnVuY3Rpb24oKXtyZXR1cm4hbih0aGlzKS5kYXRhKGMpfSkpfWZ1bmN0aW9uIGQodCxlLHIsaSl7Kyt6O3ZhciBvPWZ1bmN0aW9uKCl7eShcIm9uRXJyb3JcIix0KSxwKCksbz1uLm5vb3B9O3koXCJiZWZvcmVMb2FkXCIsdCk7dmFyIHU9YS5hdHRyaWJ1dGUsbD1hLnNyY3NldEF0dHJpYnV0ZSxmPWEuc2l6ZXNBdHRyaWJ1dGUsYz1hLnJldGluYUF0dHJpYnV0ZSxzPWEucmVtb3ZlQXR0cmlidXRlLGQ9YS5sb2FkZWROYW1lLEE9dC5hdHRyKGMpO2lmKGkpe3ZhciBnPWZ1bmN0aW9uKCl7cyYmdC5yZW1vdmVBdHRyKGEubG9hZGVyQXR0cmlidXRlKSx0LmRhdGEoZCwhMCkseShULHQpLHNldFRpbWVvdXQocCwxKSxnPW4ubm9vcH07dC5vZmYoSSkub25lKEksbykub25lKEQsZykseShpLHQsZnVuY3Rpb24oZSl7ZT8odC5vZmYoRCksZygpKToodC5vZmYoSSksbygpKX0pfHx0LnRyaWdnZXIoSSl9ZWxzZXt2YXIgaD1uKG5ldyBJbWFnZSk7aC5vbmUoSSxvKS5vbmUoRCxmdW5jdGlvbigpe3QuaGlkZSgpLGU9PT1OP3QuYXR0cihDLGguYXR0cihDKSkuYXR0cihGLGguYXR0cihGKSkuYXR0cihFLGguYXR0cihFKSk6dC5jc3MoTyxcInVybCgnXCIraC5hdHRyKEUpK1wiJylcIiksdFthLmVmZmVjdF0oYS5lZmZlY3RUaW1lKSxzJiYodC5yZW1vdmVBdHRyKHUrXCIgXCIrbCtcIiBcIitjK1wiIFwiK2EuaW1hZ2VCYXNlQXR0cmlidXRlKSxmIT09QyYmdC5yZW1vdmVBdHRyKGYpKSx0LmRhdGEoZCwhMCkseShULHQpLGgucmVtb3ZlKCkscCgpfSk7dmFyIG09KEwmJkE/QTp0LmF0dHIodSkpfHxcIlwiO2guYXR0cihDLHQuYXR0cihmKSkuYXR0cihGLHQuYXR0cihsKSkuYXR0cihFLG0/cittOm51bGwpLGguY29tcGxldGUmJmgudHJpZ2dlcihEKX19ZnVuY3Rpb24gQSh0KXt2YXIgZT10LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLHI9YS5zY3JvbGxEaXJlY3Rpb24sbj1hLnRocmVzaG9sZCxpPWgoKStuPmUudG9wJiYtbjxlLmJvdHRvbSxvPWcoKStuPmUubGVmdCYmLW48ZS5yaWdodDtyZXR1cm5cInZlcnRpY2FsXCI9PT1yP2k6XCJob3Jpem9udGFsXCI9PT1yP286aSYmb31mdW5jdGlvbiBnKCl7cmV0dXJuIHc+PTA/dzp3PW4odCkud2lkdGgoKX1mdW5jdGlvbiBoKCl7cmV0dXJuIEI+PTA/QjpCPW4odCkuaGVpZ2h0KCl9ZnVuY3Rpb24gbSh0KXtyZXR1cm4gdC50YWdOYW1lLnRvTG93ZXJDYXNlKCl9ZnVuY3Rpb24gYih0LGUpe2lmKGUpe3ZhciByPXQuc3BsaXQoXCIsXCIpO3Q9XCJcIjtmb3IodmFyIGE9MCxuPXIubGVuZ3RoO2E8bjthKyspdCs9ZStyW2FdLnRyaW0oKSsoYSE9PW4tMT9cIixcIjpcIlwiKX1yZXR1cm4gdH1mdW5jdGlvbiB2KHQsZSl7dmFyIG4saT0wO3JldHVybiBmdW5jdGlvbihvLHUpe2Z1bmN0aW9uIGwoKXtpPStuZXcgRGF0ZSxlLmNhbGwocixvKX12YXIgZj0rbmV3IERhdGUtaTtuJiZjbGVhclRpbWVvdXQobiksZj50fHwhYS5lbmFibGVUaHJvdHRsZXx8dT9sKCk6bj1zZXRUaW1lb3V0KGwsdC1mKX19ZnVuY3Rpb24gcCgpey0teixpLmxlbmd0aHx8enx8eShcIm9uRmluaXNoZWRBbGxcIil9ZnVuY3Rpb24geSh0LGUsbil7cmV0dXJuISEodD1hW3RdKSYmKHQuYXBwbHkocixbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywxKSksITApfXZhciB6PTAsdz0tMSxCPS0xLEw9ITEsVD1cImFmdGVyTG9hZFwiLEQ9XCJsb2FkXCIsST1cImVycm9yXCIsTj1cImltZ1wiLEU9XCJzcmNcIixGPVwic3Jjc2V0XCIsQz1cInNpemVzXCIsTz1cImJhY2tncm91bmQtaW1hZ2VcIjtcImV2ZW50XCI9PT1hLmJpbmR8fG8/ZigpOm4odCkub24oRCtcIi5cIitsLGYpfWZ1bmN0aW9uIGEoYSxvKXt2YXIgdT10aGlzLGw9bi5leHRlbmQoe30sdS5jb25maWcsbyksZj17fSxjPWwubmFtZStcIi1cIisgKytpO3JldHVybiB1LmNvbmZpZz1mdW5jdGlvbih0LHIpe3JldHVybiByPT09ZT9sW3RdOihsW3RdPXIsdSl9LHUuYWRkSXRlbXM9ZnVuY3Rpb24odCl7cmV0dXJuIGYuYSYmZi5hKFwic3RyaW5nXCI9PT1uLnR5cGUodCk/bih0KTp0KSx1fSx1LmdldEl0ZW1zPWZ1bmN0aW9uKCl7cmV0dXJuIGYuZz9mLmcoKTp7fX0sdS51cGRhdGU9ZnVuY3Rpb24odCl7cmV0dXJuIGYuZSYmZi5lKHt9LCF0KSx1fSx1LmZvcmNlPWZ1bmN0aW9uKHQpe3JldHVybiBmLmYmJmYuZihcInN0cmluZ1wiPT09bi50eXBlKHQpP24odCk6dCksdX0sdS5sb2FkQWxsPWZ1bmN0aW9uKCl7cmV0dXJuIGYuZSYmZi5lKHthbGw6ITB9LCEwKSx1fSx1LmRlc3Ryb3k9ZnVuY3Rpb24oKXtyZXR1cm4gbihsLmFwcGVuZFNjcm9sbCkub2ZmKFwiLlwiK2MsZi5lKSxuKHQpLm9mZihcIi5cIitjKSxmPXt9LGV9LHIodSxsLGEsZixjKSxsLmNoYWluYWJsZT9hOnV9dmFyIG49dC5qUXVlcnl8fHQuWmVwdG8saT0wLG89ITE7bi5mbi5MYXp5PW4uZm4ubGF6eT1mdW5jdGlvbih0KXtyZXR1cm4gbmV3IGEodGhpcyx0KX0sbi5MYXp5PW4ubGF6eT1mdW5jdGlvbih0LHIsaSl7aWYobi5pc0Z1bmN0aW9uKHIpJiYoaT1yLHI9W10pLG4uaXNGdW5jdGlvbihpKSl7dD1uLmlzQXJyYXkodCk/dDpbdF0scj1uLmlzQXJyYXkocik/cjpbcl07Zm9yKHZhciBvPWEucHJvdG90eXBlLmNvbmZpZyx1PW8uX2Z8fChvLl9mPXt9KSxsPTAsZj10Lmxlbmd0aDtsPGY7bCsrKShvW3RbbF1dPT09ZXx8bi5pc0Z1bmN0aW9uKG9bdFtsXV0pKSYmKG9bdFtsXV09aSk7Zm9yKHZhciBjPTAscz1yLmxlbmd0aDtjPHM7YysrKXVbcltjXV09dFswXX19LGEucHJvdG90eXBlLmNvbmZpZz17bmFtZTpcImxhenlcIixjaGFpbmFibGU6ITAsYXV0b0Rlc3Ryb3k6ITAsYmluZDpcImxvYWRcIix0aHJlc2hvbGQ6NTAwLHZpc2libGVPbmx5OiExLGFwcGVuZFNjcm9sbDp0LHNjcm9sbERpcmVjdGlvbjpcImJvdGhcIixpbWFnZUJhc2U6bnVsbCxkZWZhdWx0SW1hZ2U6XCJkYXRhOmltYWdlL2dpZjtiYXNlNjQsUjBsR09EbGhBUUFCQUlBQUFQLy8vd0FBQUNINUJBRUFBQUFBTEFBQUFBQUJBQUVBQUFJQ1JBRUFPdz09XCIscGxhY2Vob2xkZXI6bnVsbCxkZWxheTotMSxjb21iaW5lZDohMSxhdHRyaWJ1dGU6XCJkYXRhLXNyY1wiLHNyY3NldEF0dHJpYnV0ZTpcImRhdGEtc3Jjc2V0XCIsc2l6ZXNBdHRyaWJ1dGU6XCJkYXRhLXNpemVzXCIscmV0aW5hQXR0cmlidXRlOlwiZGF0YS1yZXRpbmFcIixsb2FkZXJBdHRyaWJ1dGU6XCJkYXRhLWxvYWRlclwiLGltYWdlQmFzZUF0dHJpYnV0ZTpcImRhdGEtaW1hZ2ViYXNlXCIscmVtb3ZlQXR0cmlidXRlOiEwLGhhbmRsZWROYW1lOlwiaGFuZGxlZFwiLGxvYWRlZE5hbWU6XCJsb2FkZWRcIixlZmZlY3Q6XCJzaG93XCIsZWZmZWN0VGltZTowLGVuYWJsZVRocm90dGxlOiEwLHRocm90dGxlOjI1MCxiZWZvcmVMb2FkOmUsYWZ0ZXJMb2FkOmUsb25FcnJvcjplLG9uRmluaXNoZWRBbGw6ZX0sbih0KS5vbihcImxvYWRcIixmdW5jdGlvbigpe289ITB9KX0od2luZG93KTsiLCIvKiFcbiAqIGpRdWVyeSAmIFplcHRvIExhenkgLSBBSkFYIFBsdWdpbiAtIHYxLjRcbiAqIGh0dHA6Ly9qcXVlcnkuZWlzYmVoci5kZS9sYXp5L1xuICpcbiAqIENvcHlyaWdodCAyMDEyIC0gMjAxOCwgRGFuaWVsICdFaXNiZWhyJyBLZXJuXG4gKlxuICogRHVhbCBsaWNlbnNlZCB1bmRlciB0aGUgTUlUIGFuZCBHUEwtMi4wIGxpY2Vuc2VzOlxuICogaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHBcbiAqIGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy9ncGwtMi4wLmh0bWxcbiAqL1xuOyhmdW5jdGlvbigkKSB7XG4gICAgLy8gbG9hZCBkYXRhIGJ5IGFqYXggcmVxdWVzdCBhbmQgcGFzcyB0aGVtIHRvIGVsZW1lbnRzIGlubmVyIGh0bWwsIGxpa2U6XG4gICAgLy8gPGRpdiBkYXRhLWxvYWRlcj1cImFqYXhcIiBkYXRhLXNyYz1cInVybC5odG1sXCIgZGF0YS1tZXRob2Q9XCJwb3N0XCIgZGF0YS10eXBlPVwiaHRtbFwiPjwvZGl2PlxuICAgICQubGF6eSgnYWpheCcsIGZ1bmN0aW9uKGVsZW1lbnQsIHJlc3BvbnNlKSB7XG4gICAgICAgIGFqYXhSZXF1ZXN0KHRoaXMsIGVsZW1lbnQsIHJlc3BvbnNlLCBlbGVtZW50LmF0dHIoJ2RhdGEtbWV0aG9kJykpO1xuICAgIH0pO1xuXG4gICAgLy8gbG9hZCBkYXRhIGJ5IGFqYXggZ2V0IHJlcXVlc3QgYW5kIHBhc3MgdGhlbSB0byBlbGVtZW50cyBpbm5lciBodG1sLCBsaWtlOlxuICAgIC8vIDxkaXYgZGF0YS1sb2FkZXI9XCJnZXRcIiBkYXRhLXNyYz1cInVybC5odG1sXCIgZGF0YS10eXBlPVwiaHRtbFwiPjwvZGl2PlxuICAgICQubGF6eSgnZ2V0JywgZnVuY3Rpb24oZWxlbWVudCwgcmVzcG9uc2UpIHtcbiAgICAgICAgYWpheFJlcXVlc3QodGhpcywgZWxlbWVudCwgcmVzcG9uc2UsICdHRVQnKTtcbiAgICB9KTtcblxuICAgIC8vIGxvYWQgZGF0YSBieSBhamF4IHBvc3QgcmVxdWVzdCBhbmQgcGFzcyB0aGVtIHRvIGVsZW1lbnRzIGlubmVyIGh0bWwsIGxpa2U6XG4gICAgLy8gPGRpdiBkYXRhLWxvYWRlcj1cInBvc3RcIiBkYXRhLXNyYz1cInVybC5odG1sXCIgZGF0YS10eXBlPVwiaHRtbFwiPjwvZGl2PlxuICAgICQubGF6eSgncG9zdCcsIGZ1bmN0aW9uKGVsZW1lbnQsIHJlc3BvbnNlKSB7XG4gICAgICAgIGFqYXhSZXF1ZXN0KHRoaXMsIGVsZW1lbnQsIHJlc3BvbnNlLCAnUE9TVCcpO1xuICAgIH0pO1xuXG4gICAgLy8gbG9hZCBkYXRhIGJ5IGFqYXggcHV0IHJlcXVlc3QgYW5kIHBhc3MgdGhlbSB0byBlbGVtZW50cyBpbm5lciBodG1sLCBsaWtlOlxuICAgIC8vIDxkaXYgZGF0YS1sb2FkZXI9XCJwdXRcIiBkYXRhLXNyYz1cInVybC5odG1sXCIgZGF0YS10eXBlPVwiaHRtbFwiPjwvZGl2PlxuICAgICQubGF6eSgncHV0JywgZnVuY3Rpb24oZWxlbWVudCwgcmVzcG9uc2UpIHtcbiAgICAgICAgYWpheFJlcXVlc3QodGhpcywgZWxlbWVudCwgcmVzcG9uc2UsICdQVVQnKTtcbiAgICB9KTtcblxuICAgIC8qKlxuICAgICAqIGV4ZWN1dGUgYWpheCByZXF1ZXN0IGFuZCBoYW5kbGUgcmVzcG9uc2VcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gaW5zdGFuY2VcbiAgICAgKiBAcGFyYW0ge2pRdWVyeXxvYmplY3R9IGVsZW1lbnRcbiAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSByZXNwb25zZVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbbWV0aG9kXVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGFqYXhSZXF1ZXN0KGluc3RhbmNlLCBlbGVtZW50LCByZXNwb25zZSwgbWV0aG9kKSB7XG4gICAgICAgIG1ldGhvZCA9IG1ldGhvZCA/IG1ldGhvZC50b1VwcGVyQ2FzZSgpIDogJ0dFVCc7XG5cbiAgICAgICAgdmFyIGRhdGE7XG4gICAgICAgIGlmICgobWV0aG9kID09PSAnUE9TVCcgfHwgbWV0aG9kID09PSAnUFVUJykgJiYgaW5zdGFuY2UuY29uZmlnKCdhamF4Q3JlYXRlRGF0YScpKSB7XG4gICAgICAgICAgICBkYXRhID0gaW5zdGFuY2UuY29uZmlnKCdhamF4Q3JlYXRlRGF0YScpLmFwcGx5KGluc3RhbmNlLCBbZWxlbWVudF0pO1xuICAgICAgICB9XG5cbiAgICAgICAgJC5hamF4KHtcbiAgICAgICAgICAgIHVybDogZWxlbWVudC5hdHRyKCdkYXRhLXNyYycpLFxuICAgICAgICAgICAgdHlwZTogbWV0aG9kID09PSAnUE9TVCcgfHwgbWV0aG9kID09PSAnUFVUJyA/IG1ldGhvZCA6ICdHRVQnLFxuICAgICAgICAgICAgZGF0YTogZGF0YSxcbiAgICAgICAgICAgIGRhdGFUeXBlOiBlbGVtZW50LmF0dHIoJ2RhdGEtdHlwZScpIHx8ICdodG1sJyxcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBzdWNjZXNzIGNhbGxiYWNrXG4gICAgICAgICAgICAgKiBAYWNjZXNzIHByaXZhdGVcbiAgICAgICAgICAgICAqIEBwYXJhbSB7Kn0gY29udGVudFxuICAgICAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgc3VjY2VzczogZnVuY3Rpb24oY29udGVudCkge1xuICAgICAgICAgICAgICAgIC8vIHNldCByZXNwb25kZWQgZGF0YSB0byBlbGVtZW50J3MgaW5uZXIgaHRtbFxuICAgICAgICAgICAgICAgIGVsZW1lbnQuaHRtbChjb250ZW50KTtcblxuICAgICAgICAgICAgICAgIC8vIHVzZSByZXNwb25zZSBmdW5jdGlvbiBmb3IgWmVwdG9cbiAgICAgICAgICAgICAgICByZXNwb25zZSh0cnVlKTtcblxuICAgICAgICAgICAgICAgIC8vIHJlbW92ZSBhdHRyaWJ1dGVzXG4gICAgICAgICAgICAgICAgaWYgKGluc3RhbmNlLmNvbmZpZygncmVtb3ZlQXR0cmlidXRlJykpIHtcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5yZW1vdmVBdHRyKCdkYXRhLXNyYyBkYXRhLW1ldGhvZCBkYXRhLXR5cGUnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIGVycm9yIGNhbGxiYWNrXG4gICAgICAgICAgICAgKiBAYWNjZXNzIHByaXZhdGVcbiAgICAgICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGVycm9yOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAvLyBwYXNzIGVycm9yIHN0YXRlIHRvIGxhenlcbiAgICAgICAgICAgICAgICAvLyB1c2UgcmVzcG9uc2UgZnVuY3Rpb24gZm9yIFplcHRvXG4gICAgICAgICAgICAgICAgcmVzcG9uc2UoZmFsc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG59KSh3aW5kb3cualF1ZXJ5IHx8IHdpbmRvdy5aZXB0byk7XG5cbi8qIVxuICogalF1ZXJ5ICYgWmVwdG8gTGF6eSAtIEFWIFBsdWdpbiAtIHYxLjRcbiAqIGh0dHA6Ly9qcXVlcnkuZWlzYmVoci5kZS9sYXp5L1xuICpcbiAqIENvcHlyaWdodCAyMDEyIC0gMjAxOCwgRGFuaWVsICdFaXNiZWhyJyBLZXJuXG4gKlxuICogRHVhbCBsaWNlbnNlZCB1bmRlciB0aGUgTUlUIGFuZCBHUEwtMi4wIGxpY2Vuc2VzOlxuICogaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHBcbiAqIGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy9ncGwtMi4wLmh0bWxcbiAqL1xuOyhmdW5jdGlvbigkKSB7XG4gICAgLy8gbG9hZHMgYXVkaW8gYW5kIHZpZGVvIHRhZ3MgaW5jbHVkaW5nIHRyYWNrcyBieSB0d28gd2F5cywgbGlrZTpcbiAgICAvLyA8YXVkaW8+XG4gICAgLy8gICA8ZGF0YS1zcmMgc3JjPVwiYXVkaW8ub2dnXCIgdHlwZT1cInZpZGVvL29nZ1wiPjwvZGF0YS1zcmM+XG4gICAgLy8gICA8ZGF0YS1zcmMgc3JjPVwiYXVkaW8ubXAzXCIgdHlwZT1cInZpZGVvL21wM1wiPjwvZGF0YS1zcmM+XG4gICAgLy8gPC9hdWRpbz5cbiAgICAvLyA8dmlkZW8gZGF0YS1wb3N0ZXI9XCJwb3N0ZXIuanBnXCI+XG4gICAgLy8gICA8ZGF0YS1zcmMgc3JjPVwidmlkZW8ub2d2XCIgdHlwZT1cInZpZGVvL29ndlwiPjwvZGF0YS1zcmM+XG4gICAgLy8gICA8ZGF0YS1zcmMgc3JjPVwidmlkZW8ud2VibVwiIHR5cGU9XCJ2aWRlby93ZWJtXCI+PC9kYXRhLXNyYz5cbiAgICAvLyAgIDxkYXRhLXNyYyBzcmM9XCJ2aWRlby5tcDRcIiB0eXBlPVwidmlkZW8vbXA0XCI+PC9kYXRhLXNyYz5cbiAgICAvLyAgIDxkYXRhLXRyYWNrIGtpbmQ9XCJjYXB0aW9uc1wiIHNyYz1cImNhcHRpb25zLnZ0dFwiIHNyY2xhbmc9XCJlblwiPjwvZGF0YS10cmFjaz5cbiAgICAvLyAgIDxkYXRhLXRyYWNrIGtpbmQ9XCJkZXNjcmlwdGlvbnNcIiBzcmM9XCJkZXNjcmlwdGlvbnMudnR0XCIgc3JjbGFuZz1cImVuXCI+PC9kYXRhLXRyYWNrPlxuICAgIC8vICAgPGRhdGEtdHJhY2sga2luZD1cInN1YnRpdGxlc1wiIHNyYz1cInN1YnRpdGxlcy52dHRcIiBzcmNsYW5nPVwiZGVcIj48L2RhdGEtdHJhY2s+XG4gICAgLy8gPC92aWRlbz5cbiAgICAvL1xuICAgIC8vIG9yOlxuICAgIC8vIDxhdWRpbyBkYXRhLXNyYz1cImF1ZGlvLm9nZ3x2aWRlby9vZ2csdmlkZW8ubXAzfHZpZGVvL21wM1wiPjwvdmlkZW8+XG4gICAgLy8gPHZpZGVvIGRhdGEtcG9zdGVyPVwicG9zdGVyLmpwZ1wiIGRhdGEtc3JjPVwidmlkZW8ub2d2fHZpZGVvL29ndix2aWRlby53ZWJtfHZpZGVvL3dlYm0sdmlkZW8ubXA0fHZpZGVvL21wNFwiPlxuICAgIC8vICAgPGRhdGEtdHJhY2sga2luZD1cImNhcHRpb25zXCIgc3JjPVwiY2FwdGlvbnMudnR0XCIgc3JjbGFuZz1cImVuXCI+PC9kYXRhLXRyYWNrPlxuICAgIC8vICAgPGRhdGEtdHJhY2sga2luZD1cImRlc2NyaXB0aW9uc1wiIHNyYz1cImRlc2NyaXB0aW9ucy52dHRcIiBzcmNsYW5nPVwiZW5cIj48L2RhdGEtdHJhY2s+XG4gICAgLy8gICA8ZGF0YS10cmFjayBraW5kPVwic3VidGl0bGVzXCIgc3JjPVwic3VidGl0bGVzLnZ0dFwiIHNyY2xhbmc9XCJkZVwiPjwvZGF0YS10cmFjaz5cbiAgICAvLyA8L3ZpZGVvPlxuICAgICQubGF6eShbJ2F2JywgJ2F1ZGlvJywgJ3ZpZGVvJ10sIFsnYXVkaW8nLCAndmlkZW8nXSwgZnVuY3Rpb24oZWxlbWVudCwgcmVzcG9uc2UpIHtcbiAgICAgICAgdmFyIGVsZW1lbnRUYWdOYW1lID0gZWxlbWVudFswXS50YWdOYW1lLnRvTG93ZXJDYXNlKCk7XG5cbiAgICAgICAgaWYgKGVsZW1lbnRUYWdOYW1lID09PSAnYXVkaW8nIHx8IGVsZW1lbnRUYWdOYW1lID09PSAndmlkZW8nKSB7XG4gICAgICAgICAgICB2YXIgc3JjQXR0ciA9ICdkYXRhLXNyYycsXG4gICAgICAgICAgICAgICAgc291cmNlcyA9IGVsZW1lbnQuZmluZChzcmNBdHRyKSxcbiAgICAgICAgICAgICAgICB0cmFja3MgPSBlbGVtZW50LmZpbmQoJ2RhdGEtdHJhY2snKSxcbiAgICAgICAgICAgICAgICBzb3VyY2VzSW5FcnJvciA9IDAsXG5cbiAgICAgICAgICAgIC8vIGNyZWF0ZSBvbiBlcnJvciBjYWxsYmFjayBmb3Igc291cmNlc1xuICAgICAgICAgICAgb25FcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGlmICgrK3NvdXJjZXNJbkVycm9yID09PSBzb3VyY2VzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICByZXNwb25zZShmYWxzZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgLy8gY3JlYXRlIGNhbGxiYWNrIHRvIGhhbmRsZSBhIHNvdXJjZSBvciB0cmFjayBlbnRyeVxuICAgICAgICAgICAgaGFuZGxlU291cmNlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdmFyIHNvdXJjZSA9ICQodGhpcyksXG4gICAgICAgICAgICAgICAgICAgIHR5cGUgPSBzb3VyY2VbMF0udGFnTmFtZS50b0xvd2VyQ2FzZSgpLFxuICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzID0gc291cmNlLnByb3AoJ2F0dHJpYnV0ZXMnKSxcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0ID0gJCh0eXBlID09PSBzcmNBdHRyID8gJzxzb3VyY2U+JyA6ICc8dHJhY2s+Jyk7XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZSA9PT0gc3JjQXR0cikge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXQub25lKCdlcnJvcicsIG9uRXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICQuZWFjaChhdHRyaWJ1dGVzLCBmdW5jdGlvbihpbmRleCwgYXR0cmlidXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldC5hdHRyKGF0dHJpYnV0ZS5uYW1lLCBhdHRyaWJ1dGUudmFsdWUpO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgc291cmNlLnJlcGxhY2VXaXRoKHRhcmdldCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBjcmVhdGUgZXZlbnQgZm9yIHN1Y2Nlc3NmdWxsIGxvYWRcbiAgICAgICAgICAgIGVsZW1lbnQub25lKCdsb2FkZWRtZXRhZGF0YScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlKHRydWUpO1xuICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgLy8gcmVtb3ZlIGRlZmF1bHQgY2FsbGJhY2tzIHRvIGlnbm9yZSBsb2FkaW5nIHBvc3RlciBpbWFnZVxuICAgICAgICAgICAgLm9mZignbG9hZCBlcnJvcicpXG5cbiAgICAgICAgICAgIC8vIGxvYWQgcG9zdGVyIGltYWdlXG4gICAgICAgICAgICAuYXR0cigncG9zdGVyJywgZWxlbWVudC5hdHRyKCdkYXRhLXBvc3RlcicpKTtcblxuICAgICAgICAgICAgLy8gbG9hZCBieSBjaGlsZCB0YWdzXG4gICAgICAgICAgICBpZiAoc291cmNlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBzb3VyY2VzLmVhY2goaGFuZGxlU291cmNlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gbG9hZCBieSBhdHRyaWJ1dGVcbiAgICAgICAgICAgIGVsc2UgaWYgKGVsZW1lbnQuYXR0cihzcmNBdHRyKSkge1xuICAgICAgICAgICAgICAgIC8vIHNwbGl0IGZvciBldmVyeSBlbnRyeSBieSBjb21tYVxuICAgICAgICAgICAgICAgICQuZWFjaChlbGVtZW50LmF0dHIoc3JjQXR0cikuc3BsaXQoJywnKSwgZnVuY3Rpb24oaW5kZXgsIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHNwbGl0IGFnYWluIGZvciBmaWxlIGFuZCBmaWxlIHR5cGVcbiAgICAgICAgICAgICAgICAgICAgdmFyIHBhcnRzID0gdmFsdWUuc3BsaXQoJ3wnKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBjcmVhdGUgYSBzb3VyY2UgZW50cnlcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5hcHBlbmQoJCgnPHNvdXJjZT4nKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgLm9uZSgnZXJyb3InLCBvbkVycm9yKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoe3NyYzogcGFydHNbMF0udHJpbSgpLCB0eXBlOiBwYXJ0c1sxXS50cmltKCl9KSk7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAvLyByZW1vdmUgbm93IG9ic29sZXRlIGF0dHJpYnV0ZVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZygncmVtb3ZlQXR0cmlidXRlJykpIHtcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5yZW1vdmVBdHRyKHNyY0F0dHIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gcGFzcyBlcnJvciBzdGF0ZVxuICAgICAgICAgICAgICAgIC8vIHVzZSByZXNwb25zZSBmdW5jdGlvbiBmb3IgWmVwdG9cbiAgICAgICAgICAgICAgICByZXNwb25zZShmYWxzZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGxvYWQgb3B0aW9uYWwgdHJhY2tzXG4gICAgICAgICAgICBpZiAodHJhY2tzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHRyYWNrcy5lYWNoKGhhbmRsZVNvdXJjZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIHBhc3MgZXJyb3Igc3RhdGVcbiAgICAgICAgICAgIC8vIHVzZSByZXNwb25zZSBmdW5jdGlvbiBmb3IgWmVwdG9cbiAgICAgICAgICAgIHJlc3BvbnNlKGZhbHNlKTtcbiAgICAgICAgfVxuICAgIH0pO1xufSkod2luZG93LmpRdWVyeSB8fCB3aW5kb3cuWmVwdG8pO1xuXG4vKiFcbiAqIGpRdWVyeSAmIFplcHRvIExhenkgLSBpRnJhbWUgUGx1Z2luIC0gdjEuNVxuICogaHR0cDovL2pxdWVyeS5laXNiZWhyLmRlL2xhenkvXG4gKlxuICogQ29weXJpZ2h0IDIwMTIgLSAyMDE4LCBEYW5pZWwgJ0Vpc2JlaHInIEtlcm5cbiAqXG4gKiBEdWFsIGxpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgYW5kIEdQTC0yLjAgbGljZW5zZXM6XG4gKiBodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL21pdC1saWNlbnNlLnBocFxuICogaHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzL2dwbC0yLjAuaHRtbFxuICovXG47KGZ1bmN0aW9uKCQpIHtcbiAgICAvLyBsb2FkIGlmcmFtZSBjb250ZW50LCBsaWtlOlxuICAgIC8vIDxpZnJhbWUgZGF0YS1zcmM9XCJpZnJhbWUuaHRtbFwiPjwvaWZyYW1lPlxuICAgIC8vXG4gICAgLy8gZW5hYmxlIGNvbnRlbnQgZXJyb3IgY2hlY2sgd2l0aDpcbiAgICAvLyA8aWZyYW1lIGRhdGEtc3JjPVwiaWZyYW1lLmh0bWxcIiBkYXRhLWVycm9yLWRldGVjdD1cInRydWVcIj48L2lmcmFtZT5cbiAgICAkLmxhenkoWydmcmFtZScsICdpZnJhbWUnXSwgJ2lmcmFtZScsIGZ1bmN0aW9uKGVsZW1lbnQsIHJlc3BvbnNlKSB7XG4gICAgICAgIHZhciBpbnN0YW5jZSA9IHRoaXM7XG5cbiAgICAgICAgaWYgKGVsZW1lbnRbMF0udGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSAnaWZyYW1lJykge1xuICAgICAgICAgICAgdmFyIHNyY0F0dHIgPSAnZGF0YS1zcmMnLFxuICAgICAgICAgICAgICAgIGVycm9yRGV0ZWN0QXR0ciA9ICdkYXRhLWVycm9yLWRldGVjdCcsXG4gICAgICAgICAgICAgICAgZXJyb3JEZXRlY3QgPSBlbGVtZW50LmF0dHIoZXJyb3JEZXRlY3RBdHRyKTtcblxuICAgICAgICAgICAgLy8gZGVmYXVsdCB3YXksIGp1c3QgcmVwbGFjZSB0aGUgJ3NyYycgYXR0cmlidXRlXG4gICAgICAgICAgICBpZiAoZXJyb3JEZXRlY3QgIT09ICd0cnVlJyAmJiBlcnJvckRldGVjdCAhPT0gJzEnKSB7XG4gICAgICAgICAgICAgICAgLy8gc2V0IGlmcmFtZSBzb3VyY2VcbiAgICAgICAgICAgICAgICBlbGVtZW50LmF0dHIoJ3NyYycsIGVsZW1lbnQuYXR0cihzcmNBdHRyKSk7XG5cbiAgICAgICAgICAgICAgICAvLyByZW1vdmUgYXR0cmlidXRlc1xuICAgICAgICAgICAgICAgIGlmIChpbnN0YW5jZS5jb25maWcoJ3JlbW92ZUF0dHJpYnV0ZScpKSB7XG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQucmVtb3ZlQXR0cihzcmNBdHRyICsgJyAnICsgZXJyb3JEZXRlY3RBdHRyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGV4dGVuZGVkIHdheSwgZXZlbiBjaGVjayBpZiB0aGUgZG9jdW1lbnQgaXMgYXZhaWxhYmxlXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAkLmFqYXgoe1xuICAgICAgICAgICAgICAgICAgICB1cmw6IGVsZW1lbnQuYXR0cihzcmNBdHRyKSxcbiAgICAgICAgICAgICAgICAgICAgZGF0YVR5cGU6ICdodG1sJyxcbiAgICAgICAgICAgICAgICAgICAgY3Jvc3NEb21haW46IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIHhockZpZWxkczoge3dpdGhDcmVkZW50aWFsczogdHJ1ZX0sXG5cbiAgICAgICAgICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgICAgICAgICAqIHN1Y2Nlc3MgY2FsbGJhY2tcbiAgICAgICAgICAgICAgICAgICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICAgICAgICAgICAgICAgICAqIEBwYXJhbSB7Kn0gY29udGVudFxuICAgICAgICAgICAgICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZnVuY3Rpb24oY29udGVudCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2V0IHJlc3BvbmRlZCBkYXRhIHRvIGVsZW1lbnQncyBpbm5lciBodG1sXG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50Lmh0bWwoY29udGVudClcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2hhbmdlIGlmcmFtZSBzcmNcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdzcmMnLCBlbGVtZW50LmF0dHIoc3JjQXR0cikpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyByZW1vdmUgYXR0cmlidXRlc1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGluc3RhbmNlLmNvbmZpZygncmVtb3ZlQXR0cmlidXRlJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50LnJlbW92ZUF0dHIoc3JjQXR0ciArICcgJyArIGVycm9yRGV0ZWN0QXR0cik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgICAgICAgICAqIGVycm9yIGNhbGxiYWNrXG4gICAgICAgICAgICAgICAgICAgICAqIEBhY2Nlc3MgcHJpdmF0ZVxuICAgICAgICAgICAgICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gcGFzcyBlcnJvciBzdGF0ZSB0byBsYXp5XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB1c2UgcmVzcG9uc2UgZnVuY3Rpb24gZm9yIFplcHRvXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNwb25zZShmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgLy8gcGFzcyBlcnJvciBzdGF0ZSB0byBsYXp5XG4gICAgICAgICAgICAvLyB1c2UgcmVzcG9uc2UgZnVuY3Rpb24gZm9yIFplcHRvXG4gICAgICAgICAgICByZXNwb25zZShmYWxzZSk7XG4gICAgICAgIH1cbiAgICB9KTtcbn0pKHdpbmRvdy5qUXVlcnkgfHwgd2luZG93LlplcHRvKTtcblxuLyohXG4gKiBqUXVlcnkgJiBaZXB0byBMYXp5IC0gTk9PUCBQbHVnaW4gLSB2MS4yXG4gKiBodHRwOi8vanF1ZXJ5LmVpc2JlaHIuZGUvbGF6eS9cbiAqXG4gKiBDb3B5cmlnaHQgMjAxMiAtIDIwMTgsIERhbmllbCAnRWlzYmVocicgS2VyblxuICpcbiAqIER1YWwgbGljZW5zZWQgdW5kZXIgdGhlIE1JVCBhbmQgR1BMLTIuMCBsaWNlbnNlczpcbiAqIGh0dHA6Ly93d3cub3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvbWl0LWxpY2Vuc2UucGhwXG4gKiBodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvZ3BsLTIuMC5odG1sXG4gKi9cbjsoZnVuY3Rpb24oJCkge1xuICAgIC8vIHdpbGwgZG8gbm90aGluZywgdXNlZCB0byBkaXNhYmxlIGVsZW1lbnRzIG9yIGZvciBkZXZlbG9wbWVudFxuICAgIC8vIHVzZSBsaWtlOlxuICAgIC8vIDxkaXYgZGF0YS1sb2FkZXI9XCJub29wXCI+PC9kaXY+XG5cbiAgICAvLyBkb2VzIG5vdCBkbyBhbnl0aGluZywganVzdCBhICduby1vcGVyYXRpb24nIGhlbHBlciA7KVxuICAgICQubGF6eSgnbm9vcCcsIGZ1bmN0aW9uKCkge30pO1xuXG4gICAgLy8gZG9lcyBub3RoaW5nLCBidXQgcmVzcG9uc2UgYSBzdWNjZXNzZnVsbCBsb2FkaW5nXG4gICAgJC5sYXp5KCdub29wLXN1Y2Nlc3MnLCBmdW5jdGlvbihlbGVtZW50LCByZXNwb25zZSkge1xuICAgICAgICAvLyB1c2UgcmVzcG9uc2UgZnVuY3Rpb24gZm9yIFplcHRvXG4gICAgICAgIHJlc3BvbnNlKHRydWUpO1xuICAgIH0pO1xuXG4gICAgLy8gZG9lcyBub3RoaW5nLCBidXQgcmVzcG9uc2UgYSBmYWlsZWQgbG9hZGluZ1xuICAgICQubGF6eSgnbm9vcC1lcnJvcicsIGZ1bmN0aW9uKGVsZW1lbnQsIHJlc3BvbnNlKSB7XG4gICAgICAgIC8vIHVzZSByZXNwb25zZSBmdW5jdGlvbiBmb3IgWmVwdG9cbiAgICAgICAgcmVzcG9uc2UoZmFsc2UpO1xuICAgIH0pO1xufSkod2luZG93LmpRdWVyeSB8fCB3aW5kb3cuWmVwdG8pO1xuXG4vKiFcbiAqIGpRdWVyeSAmIFplcHRvIExhenkgLSBQaWN0dXJlIFBsdWdpbiAtIHYxLjNcbiAqIGh0dHA6Ly9qcXVlcnkuZWlzYmVoci5kZS9sYXp5L1xuICpcbiAqIENvcHlyaWdodCAyMDEyIC0gMjAxOCwgRGFuaWVsICdFaXNiZWhyJyBLZXJuXG4gKlxuICogRHVhbCBsaWNlbnNlZCB1bmRlciB0aGUgTUlUIGFuZCBHUEwtMi4wIGxpY2Vuc2VzOlxuICogaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHBcbiAqIGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy9ncGwtMi4wLmh0bWxcbiAqL1xuOyhmdW5jdGlvbigkKSB7XG4gICAgdmFyIHNyY0F0dHIgPSAnZGF0YS1zcmMnLFxuICAgICAgICBzcmNzZXRBdHRyID0gJ2RhdGEtc3Jjc2V0JyxcbiAgICAgICAgbWVkaWFBdHRyID0gJ2RhdGEtbWVkaWEnLFxuICAgICAgICBzaXplc0F0dHIgPSAnZGF0YS1zaXplcycsXG4gICAgICAgIHR5cGVBdHRyID0gJ2RhdGEtdHlwZSc7XG5cbiAgICAvLyBsb2FkcyBwaWN0dXJlIGVsZW1lbnRzIGxpa2U6XG4gICAgLy8gPHBpY3R1cmU+XG4gICAgLy8gICA8ZGF0YS1zcmMgc3Jjc2V0PVwiMXguanBnIDF4LCAyeC5qcGcgMngsIDN4LmpwZyAzeFwiIG1lZGlhPVwiKG1pbi13aWR0aDogNjAwcHgpXCIgdHlwZT1cImltYWdlL2pwZWdcIj48L2RhdGEtc3JjPlxuICAgIC8vICAgPGRhdGEtc3JjIHNyY3NldD1cIjF4LmpwZyAxeCwgMnguanBnIDJ4LCAzeC5qcGcgM3hcIiBtZWRpYT1cIihtaW4td2lkdGg6IDQwMHB4KVwiIHR5cGU9XCJpbWFnZS9qcGVnXCI+PC9kYXRhLXNyYz5cbiAgICAvLyAgIDxkYXRhLWltZyBzcmM9XCJkZWZhdWx0LmpwZ1wiID5cbiAgICAvLyA8L3BpY3R1cmU+XG4gICAgLy9cbiAgICAvLyBvcjpcbiAgICAvLyA8cGljdHVyZSBkYXRhLXNyYz1cImRlZmF1bHQuanBnXCI+XG4gICAgLy8gICA8ZGF0YS1zcmMgc3Jjc2V0PVwiMXguanBnIDF4LCAyeC5qcGcgMngsIDN4LmpwZyAzeFwiIG1lZGlhPVwiKG1pbi13aWR0aDogNjAwcHgpXCIgdHlwZT1cImltYWdlL2pwZWdcIj48L2RhdGEtc3JjPlxuICAgIC8vICAgPGRhdGEtc3JjIHNyY3NldD1cIjF4LmpwZyAxeCwgMnguanBnIDJ4LCAzeC5qcGcgM3hcIiBtZWRpYT1cIihtaW4td2lkdGg6IDQwMHB4KVwiIHR5cGU9XCJpbWFnZS9qcGVnXCI+PC9kYXRhLXNyYz5cbiAgICAvLyA8L3BpY3R1cmU+XG4gICAgLy9cbiAgICAvLyBvciBqdXN0IHdpdGggYXR0cmlidXRlcyBpbiBvbmUgbGluZTpcbiAgICAvLyA8cGljdHVyZSBkYXRhLXNyYz1cImRlZmF1bHQuanBnXCIgZGF0YS1zcmNzZXQ9XCIxeC5qcGcgMXgsIDJ4LmpwZyAyeCwgM3guanBnIDN4XCIgZGF0YS1tZWRpYT1cIihtaW4td2lkdGg6IDYwMHB4KVwiIGRhdGEtc2l6ZXM9XCJcIiBkYXRhLXR5cGU9XCJpbWFnZS9qcGVnXCIgLz5cbiAgICAkLmxhenkoWydwaWMnLCAncGljdHVyZSddLCBbJ3BpY3R1cmUnXSwgZnVuY3Rpb24oZWxlbWVudCwgcmVzcG9uc2UpIHtcbiAgICAgICAgdmFyIGVsZW1lbnRUYWdOYW1lID0gZWxlbWVudFswXS50YWdOYW1lLnRvTG93ZXJDYXNlKCk7XG5cbiAgICAgICAgaWYgKGVsZW1lbnRUYWdOYW1lID09PSAncGljdHVyZScpIHtcbiAgICAgICAgICAgIHZhciBzb3VyY2VzID0gZWxlbWVudC5maW5kKHNyY0F0dHIpLFxuICAgICAgICAgICAgICAgIGltYWdlID0gZWxlbWVudC5maW5kKCdkYXRhLWltZycpLFxuICAgICAgICAgICAgICAgIGltYWdlQmFzZSA9IHRoaXMuY29uZmlnKCdpbWFnZUJhc2UnKSB8fCAnJztcblxuICAgICAgICAgICAgLy8gaGFuZGxlIGFzIGNoaWxkIGVsZW1lbnRzXG4gICAgICAgICAgICBpZiAoc291cmNlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBzb3VyY2VzLmVhY2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbmFtZUVsZW1lbnRUYWcoJCh0aGlzKSwgJ3NvdXJjZScsIGltYWdlQmFzZSk7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAvLyBjcmVhdGUgaW1nIHRhZyBmcm9tIGNoaWxkXG4gICAgICAgICAgICAgICAgaWYgKGltYWdlLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgICAgICAgICBpbWFnZSA9IHJlbmFtZUVsZW1lbnRUYWcoaW1hZ2UsICdpbWcnLCBpbWFnZUJhc2UpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGJpbmQgZXZlbnQgY2FsbGJhY2tzIHRvIG5ldyBpbWFnZSB0YWdcbiAgICAgICAgICAgICAgICAgICAgaW1hZ2Uub24oJ2xvYWQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlKHRydWUpO1xuICAgICAgICAgICAgICAgICAgICB9KS5vbignZXJyb3InLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaW1hZ2UuYXR0cignc3JjJywgaW1hZ2UuYXR0cihzcmNBdHRyKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnKCdyZW1vdmVBdHRyaWJ1dGUnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW1hZ2UucmVtb3ZlQXR0cihzcmNBdHRyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBpbWcgdGFnIGZyb20gYXR0cmlidXRlXG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoZWxlbWVudC5hdHRyKHNyY0F0dHIpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBpbWFnZSB0YWdcbiAgICAgICAgICAgICAgICAgICAgY3JlYXRlSW1hZ2VPYmplY3QoZWxlbWVudCwgaW1hZ2VCYXNlICsgZWxlbWVudC5hdHRyKHNyY0F0dHIpLCByZXNwb25zZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnKCdyZW1vdmVBdHRyaWJ1dGUnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5yZW1vdmVBdHRyKHNyY0F0dHIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gcGFzcyBlcnJvciBzdGF0ZVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyB1c2UgcmVzcG9uc2UgZnVuY3Rpb24gZm9yIFplcHRvXG4gICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlKGZhbHNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGhhbmRsZSBhcyBhdHRyaWJ1dGVzXG4gICAgICAgICAgICBlbHNlIGlmKCBlbGVtZW50LmF0dHIoc3Jjc2V0QXR0cikgKSB7XG4gICAgICAgICAgICAgICAgLy8gY3JlYXRlIHNvdXJjZSBlbGVtZW50cyBiZWZvcmUgaW1nIHRhZ1xuICAgICAgICAgICAgICAgICQoJzxzb3VyY2U+JykuYXR0cih7XG4gICAgICAgICAgICAgICAgICAgIG1lZGlhOiBlbGVtZW50LmF0dHIobWVkaWFBdHRyKSxcbiAgICAgICAgICAgICAgICAgICAgc2l6ZXM6IGVsZW1lbnQuYXR0cihzaXplc0F0dHIpLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBlbGVtZW50LmF0dHIodHlwZUF0dHIpLFxuICAgICAgICAgICAgICAgICAgICBzcmNzZXQ6IGdldENvcnJlY3RlZFNyY1NldChlbGVtZW50LmF0dHIoc3Jjc2V0QXR0ciksIGltYWdlQmFzZSlcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5hcHBlbmRUbyhlbGVtZW50KTtcblxuICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBpbWFnZSB0YWdcbiAgICAgICAgICAgICAgICBjcmVhdGVJbWFnZU9iamVjdChlbGVtZW50LCBpbWFnZUJhc2UgKyBlbGVtZW50LmF0dHIoc3JjQXR0ciksIHJlc3BvbnNlKTtcblxuICAgICAgICAgICAgICAgIC8vIHJlbW92ZSBhdHRyaWJ1dGVzIGZyb20gcGFyZW50IHBpY3R1cmUgZWxlbWVudFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZygncmVtb3ZlQXR0cmlidXRlJykpIHtcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5yZW1vdmVBdHRyKHNyY0F0dHIgKyAnICcgKyBzcmNzZXRBdHRyICsgJyAnICsgbWVkaWFBdHRyICsgJyAnICsgc2l6ZXNBdHRyICsgJyAnICsgdHlwZUF0dHIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gcGFzcyBlcnJvciBzdGF0ZVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gdXNlIHJlc3BvbnNlIGZ1bmN0aW9uIGZvciBaZXB0b1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlKGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgLy8gcGFzcyBlcnJvciBzdGF0ZVxuICAgICAgICAgICAgLy8gdXNlIHJlc3BvbnNlIGZ1bmN0aW9uIGZvciBaZXB0b1xuICAgICAgICAgICAgcmVzcG9uc2UoZmFsc2UpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICAvKipcbiAgICAgKiBjcmVhdGUgYSBuZXcgY2hpbGQgZWxlbWVudCBhbmQgY29weSBhdHRyaWJ1dGVzXG4gICAgICogQHBhcmFtIHtqUXVlcnl8b2JqZWN0fSBlbGVtZW50XG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRvVHlwZVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBpbWFnZUJhc2VcbiAgICAgKiBAcmV0dXJuIHtqUXVlcnl8b2JqZWN0fVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHJlbmFtZUVsZW1lbnRUYWcoZWxlbWVudCwgdG9UeXBlLCBpbWFnZUJhc2UpIHtcbiAgICAgICAgdmFyIGF0dHJpYnV0ZXMgPSBlbGVtZW50LnByb3AoJ2F0dHJpYnV0ZXMnKSxcbiAgICAgICAgICAgIHRhcmdldCA9ICQoJzwnICsgdG9UeXBlICsgJz4nKTtcblxuICAgICAgICAkLmVhY2goYXR0cmlidXRlcywgZnVuY3Rpb24oaW5kZXgsIGF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgLy8gYnVpbGQgc3Jjc2V0IHdpdGggaW1hZ2UgYmFzZVxuICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZS5uYW1lID09PSAnc3Jjc2V0JyB8fCBhdHRyaWJ1dGUubmFtZSA9PT0gc3JjQXR0cikge1xuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZS52YWx1ZSA9IGdldENvcnJlY3RlZFNyY1NldChhdHRyaWJ1dGUudmFsdWUsIGltYWdlQmFzZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRhcmdldC5hdHRyKGF0dHJpYnV0ZS5uYW1lLCBhdHRyaWJ1dGUudmFsdWUpO1xuICAgICAgICB9KTtcblxuICAgICAgICBlbGVtZW50LnJlcGxhY2VXaXRoKHRhcmdldCk7XG4gICAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY3JlYXRlIGEgbmV3IGltYWdlIGVsZW1lbnQgaW5zaWRlIHBhcmVudCBlbGVtZW50XG4gICAgICogQHBhcmFtIHtqUXVlcnl8b2JqZWN0fSBwYXJlbnRcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3JjXG4gICAgICogQHBhcmFtIHtmdW5jdGlvbn0gcmVzcG9uc2VcbiAgICAgKiBAcmV0dXJuIHZvaWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBjcmVhdGVJbWFnZU9iamVjdChwYXJlbnQsIHNyYywgcmVzcG9uc2UpIHtcbiAgICAgICAgLy8gY3JlYXRlIGltYWdlIHRhZ1xuICAgICAgICB2YXIgaW1hZ2VPYmogPSAkKCc8aW1nPicpXG5cbiAgICAgICAgLy8gY3JlYXRlIGltYWdlIHRhZyBhbiBiaW5kIGNhbGxiYWNrcyBmb3IgY29ycmVjdCByZXNwb25zZVxuICAgICAgICAub25lKCdsb2FkJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXNwb25zZSh0cnVlKTtcbiAgICAgICAgfSlcbiAgICAgICAgLm9uZSgnZXJyb3InLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJlc3BvbnNlKGZhbHNlKTtcbiAgICAgICAgfSlcblxuICAgICAgICAvLyBzZXQgaW50byBwaWN0dXJlIGVsZW1lbnRcbiAgICAgICAgLmFwcGVuZFRvKHBhcmVudClcblxuICAgICAgICAvLyBzZXQgc3JjIGF0dHJpYnV0ZSBhdCBsYXN0IHRvIHByZXZlbnQgZWFybHkga2ljay1pblxuICAgICAgICAuYXR0cignc3JjJywgc3JjKTtcblxuICAgICAgICAvLyBjYWxsIGFmdGVyIGxvYWQgZXZlbiBvbiBjYWNoZWQgaW1hZ2VcbiAgICAgICAgaW1hZ2VPYmouY29tcGxldGUgJiYgaW1hZ2VPYmoubG9hZCgpOyAvLyBqc2hpbnQgaWdub3JlIDogbGluZVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHByZXBlbmQgaW1hZ2UgYmFzZSB0byBhbGwgc3Jjc2V0IGVudHJpZXNcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3Jjc2V0XG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGltYWdlQmFzZVxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9XG4gICAgICovXG4gICAgZnVuY3Rpb24gZ2V0Q29ycmVjdGVkU3JjU2V0KHNyY3NldCwgaW1hZ2VCYXNlKSB7XG4gICAgICAgIGlmIChpbWFnZUJhc2UpIHtcbiAgICAgICAgICAgIC8vIHRyaW0sIHJlbW92ZSB1bm5lY2Vzc2FyeSBzcGFjZXMgYW5kIHNwbGl0IGVudHJpZXNcbiAgICAgICAgICAgIHZhciBlbnRyaWVzID0gc3Jjc2V0LnNwbGl0KCcsJyk7XG4gICAgICAgICAgICBzcmNzZXQgPSAnJztcblxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBlbnRyaWVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIHNyY3NldCArPSBpbWFnZUJhc2UgKyBlbnRyaWVzW2ldLnRyaW0oKSArIChpICE9PSBsIC0gMSA/ICcsJyA6ICcnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzcmNzZXQ7XG4gICAgfVxufSkod2luZG93LmpRdWVyeSB8fCB3aW5kb3cuWmVwdG8pO1xuXG4vKiFcbiAqIGpRdWVyeSAmIFplcHRvIExhenkgLSBTY3JpcHQgUGx1Z2luIC0gdjEuMlxuICogaHR0cDovL2pxdWVyeS5laXNiZWhyLmRlL2xhenkvXG4gKlxuICogQ29weXJpZ2h0IDIwMTIgLSAyMDE4LCBEYW5pZWwgJ0Vpc2JlaHInIEtlcm5cbiAqXG4gKiBEdWFsIGxpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgYW5kIEdQTC0yLjAgbGljZW5zZXM6XG4gKiBodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL21pdC1saWNlbnNlLnBocFxuICogaHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzL2dwbC0yLjAuaHRtbFxuICovXG47KGZ1bmN0aW9uKCQpIHtcbiAgICAvLyBsb2FkcyBqYXZhc2NyaXB0IGZpbGVzIGZvciBzY3JpcHQgdGFncywgbGlrZTpcbiAgICAvLyA8c2NyaXB0IGRhdGEtc3JjPVwiZmlsZS5qc1wiIHR5cGU9XCJ0ZXh0L2phdmFzY3JpcHRcIj48L3NjcmlwdD5cbiAgICAkLmxhenkoWydqcycsICdqYXZhc2NyaXB0JywgJ3NjcmlwdCddLCAnc2NyaXB0JywgZnVuY3Rpb24oZWxlbWVudCwgcmVzcG9uc2UpIHtcbiAgICAgICAgaWYgKGVsZW1lbnRbMF0udGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSAnc2NyaXB0Jykge1xuICAgICAgICAgICAgZWxlbWVudC5hdHRyKCdzcmMnLCBlbGVtZW50LmF0dHIoJ2RhdGEtc3JjJykpO1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgYXR0cmlidXRlXG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcoJ3JlbW92ZUF0dHJpYnV0ZScpKSB7XG4gICAgICAgICAgICAgICAgZWxlbWVudC5yZW1vdmVBdHRyKCdkYXRhLXNyYycpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgLy8gdXNlIHJlc3BvbnNlIGZ1bmN0aW9uIGZvciBaZXB0b1xuICAgICAgICAgICAgcmVzcG9uc2UoZmFsc2UpO1xuICAgICAgICB9XG4gICAgfSk7XG59KSh3aW5kb3cualF1ZXJ5IHx8IHdpbmRvdy5aZXB0byk7XG5cbi8qIVxuICogalF1ZXJ5ICYgWmVwdG8gTGF6eSAtIFZpbWVvIFBsdWdpbiAtIHYxLjFcbiAqIGh0dHA6Ly9qcXVlcnkuZWlzYmVoci5kZS9sYXp5L1xuICpcbiAqIENvcHlyaWdodCAyMDEyIC0gMjAxOCwgRGFuaWVsICdFaXNiZWhyJyBLZXJuXG4gKlxuICogRHVhbCBsaWNlbnNlZCB1bmRlciB0aGUgTUlUIGFuZCBHUEwtMi4wIGxpY2Vuc2VzOlxuICogaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHBcbiAqIGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy9ncGwtMi4wLmh0bWxcbiAqL1xuOyhmdW5jdGlvbigkKSB7XG4gICAgLy8gbG9hZCB2aW1lbyB2aWRlbyBpZnJhbWUsIGxpa2U6XG4gICAgLy8gPGlmcmFtZSBkYXRhLWxvYWRlcj1cInZpbWVvXCIgZGF0YS1zcmM9XCIxNzY4OTQxMzBcIiB3aWR0aD1cIjY0MFwiIGhlaWdodD1cIjM2MFwiIGZyYW1lYm9yZGVyPVwiMFwiIHdlYmtpdGFsbG93ZnVsbHNjcmVlbiBtb3phbGxvd2Z1bGxzY3JlZW4gYWxsb3dmdWxsc2NyZWVuPjwvaWZyYW1lPlxuICAgICQubGF6eSgndmltZW8nLCBmdW5jdGlvbihlbGVtZW50LCByZXNwb25zZSkge1xuICAgICAgICBpZiAoZWxlbWVudFswXS50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdpZnJhbWUnKSB7XG4gICAgICAgICAgICAvLyBwYXNzIHNvdXJjZSB0byBpZnJhbWVcbiAgICAgICAgICAgIGVsZW1lbnQuYXR0cignc3JjJywgJ2h0dHBzOi8vcGxheWVyLnZpbWVvLmNvbS92aWRlby8nICsgZWxlbWVudC5hdHRyKCdkYXRhLXNyYycpKTtcblxuICAgICAgICAgICAgLy8gcmVtb3ZlIGF0dHJpYnV0ZVxuICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnKCdyZW1vdmVBdHRyaWJ1dGUnKSkge1xuICAgICAgICAgICAgICAgIGVsZW1lbnQucmVtb3ZlQXR0cignZGF0YS1zcmMnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgLy8gcGFzcyBlcnJvciBzdGF0ZVxuICAgICAgICAgICAgLy8gdXNlIHJlc3BvbnNlIGZ1bmN0aW9uIGZvciBaZXB0b1xuICAgICAgICAgICAgcmVzcG9uc2UoZmFsc2UpO1xuICAgICAgICB9XG4gICAgfSk7XG59KSh3aW5kb3cualF1ZXJ5IHx8IHdpbmRvdy5aZXB0byk7XG5cbi8qIVxuICogalF1ZXJ5ICYgWmVwdG8gTGF6eSAtIFlvdVR1YmUgUGx1Z2luIC0gdjEuNVxuICogaHR0cDovL2pxdWVyeS5laXNiZWhyLmRlL2xhenkvXG4gKlxuICogQ29weXJpZ2h0IDIwMTIgLSAyMDE4LCBEYW5pZWwgJ0Vpc2JlaHInIEtlcm5cbiAqXG4gKiBEdWFsIGxpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgYW5kIEdQTC0yLjAgbGljZW5zZXM6XG4gKiBodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL21pdC1saWNlbnNlLnBocFxuICogaHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzL2dwbC0yLjAuaHRtbFxuICovXG47KGZ1bmN0aW9uKCQpIHtcbiAgICAvLyBsb2FkIHlvdXR1YmUgdmlkZW8gaWZyYW1lLCBsaWtlOlxuICAgIC8vIDxpZnJhbWUgZGF0YS1sb2FkZXI9XCJ5dFwiIGRhdGEtc3JjPVwiMUFZR253Nk13Rk1cIiBkYXRhLW5vY29va2llPVwiMVwiIHdpZHRoPVwiNTYwXCIgaGVpZ2h0PVwiMzE1XCIgZnJhbWVib3JkZXI9XCIwXCIgYWxsb3dmdWxsc2NyZWVuPjwvaWZyYW1lPlxuICAgICQubGF6eShbJ3l0JywgJ3lvdXR1YmUnXSwgZnVuY3Rpb24oZWxlbWVudCwgcmVzcG9uc2UpIHtcbiAgICAgICAgaWYgKGVsZW1lbnRbMF0udGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSAnaWZyYW1lJykge1xuICAgICAgICAgICAgLy8gcGFzcyBzb3VyY2UgdG8gaWZyYW1lXG4gICAgICAgICAgICB2YXIgbm9Db29raWUgPSAvMXx0cnVlLy50ZXN0KGVsZW1lbnQuYXR0cignZGF0YS1ub2Nvb2tpZScpKTtcbiAgICAgICAgICAgIGVsZW1lbnQuYXR0cignc3JjJywgJ2h0dHBzOi8vd3d3LnlvdXR1YmUnICsgKG5vQ29va2llID8gJy1ub2Nvb2tpZScgOiAnJykgKyAnLmNvbS9lbWJlZC8nICsgZWxlbWVudC5hdHRyKCdkYXRhLXNyYycpICsgJz9yZWw9MCZhbXA7c2hvd2luZm89MCcpO1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgYXR0cmlidXRlXG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcoJ3JlbW92ZUF0dHJpYnV0ZScpKSB7XG4gICAgICAgICAgICAgICAgZWxlbWVudC5yZW1vdmVBdHRyKCdkYXRhLXNyYycpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvLyBwYXNzIGVycm9yIHN0YXRlXG4gICAgICAgICAgICByZXNwb25zZShmYWxzZSk7XG4gICAgICAgIH1cbiAgICB9KTtcbn0pKHdpbmRvdy5qUXVlcnkgfHwgd2luZG93LlplcHRvKTsiLCIvKiEgalF1ZXJ5ICYgWmVwdG8gTGF6eSAtIEFsbCBQbHVnaW5zIHYxLjcuMTAgLSBodHRwOi8vanF1ZXJ5LmVpc2JlaHIuZGUvbGF6eSAtIE1JVCZHUEwtMi4wIGxpY2Vuc2UgLSBDb3B5cmlnaHQgMjAxMi0yMDE4IERhbmllbCAnRWlzYmVocicgS2VybiAqL1xuIWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIGEoYSxlLHIsbyl7bz1vP28udG9VcHBlckNhc2UoKTpcIkdFVFwiO3ZhciBpO1wiUE9TVFwiIT09byYmXCJQVVRcIiE9PW98fCFhLmNvbmZpZyhcImFqYXhDcmVhdGVEYXRhXCIpfHwoaT1hLmNvbmZpZyhcImFqYXhDcmVhdGVEYXRhXCIpLmFwcGx5KGEsW2VdKSksdC5hamF4KHt1cmw6ZS5hdHRyKFwiZGF0YS1zcmNcIiksdHlwZTpcIlBPU1RcIj09PW98fFwiUFVUXCI9PT1vP286XCJHRVRcIixkYXRhOmksZGF0YVR5cGU6ZS5hdHRyKFwiZGF0YS10eXBlXCIpfHxcImh0bWxcIixzdWNjZXNzOmZ1bmN0aW9uKHQpe2UuaHRtbCh0KSxyKCEwKSxhLmNvbmZpZyhcInJlbW92ZUF0dHJpYnV0ZVwiKSYmZS5yZW1vdmVBdHRyKFwiZGF0YS1zcmMgZGF0YS1tZXRob2QgZGF0YS10eXBlXCIpfSxlcnJvcjpmdW5jdGlvbigpe3IoITEpfX0pfXQubGF6eShcImFqYXhcIixmdW5jdGlvbih0LGUpe2EodGhpcyx0LGUsdC5hdHRyKFwiZGF0YS1tZXRob2RcIikpfSksdC5sYXp5KFwiZ2V0XCIsZnVuY3Rpb24odCxlKXthKHRoaXMsdCxlLFwiR0VUXCIpfSksdC5sYXp5KFwicG9zdFwiLGZ1bmN0aW9uKHQsZSl7YSh0aGlzLHQsZSxcIlBPU1RcIil9KSx0LmxhenkoXCJwdXRcIixmdW5jdGlvbih0LGUpe2EodGhpcyx0LGUsXCJQVVRcIil9KX0od2luZG93LmpRdWVyeXx8d2luZG93LlplcHRvKSxmdW5jdGlvbih0KXt0LmxhenkoW1wiYXZcIixcImF1ZGlvXCIsXCJ2aWRlb1wiXSxbXCJhdWRpb1wiLFwidmlkZW9cIl0sZnVuY3Rpb24oYSxlKXt2YXIgcj1hWzBdLnRhZ05hbWUudG9Mb3dlckNhc2UoKTtpZihcImF1ZGlvXCI9PT1yfHxcInZpZGVvXCI9PT1yKXt2YXIgbz1hLmZpbmQoXCJkYXRhLXNyY1wiKSxpPWEuZmluZChcImRhdGEtdHJhY2tcIiksbj0wLGM9ZnVuY3Rpb24oKXsrK249PT1vLmxlbmd0aCYmZSghMSl9LHM9ZnVuY3Rpb24oKXt2YXIgYT10KHRoaXMpLGU9YVswXS50YWdOYW1lLnRvTG93ZXJDYXNlKCkscj1hLnByb3AoXCJhdHRyaWJ1dGVzXCIpLG89dChcImRhdGEtc3JjXCI9PT1lP1wiPHNvdXJjZT5cIjpcIjx0cmFjaz5cIik7XCJkYXRhLXNyY1wiPT09ZSYmby5vbmUoXCJlcnJvclwiLGMpLHQuZWFjaChyLGZ1bmN0aW9uKHQsYSl7by5hdHRyKGEubmFtZSxhLnZhbHVlKX0pLGEucmVwbGFjZVdpdGgobyl9O2Eub25lKFwibG9hZGVkbWV0YWRhdGFcIixmdW5jdGlvbigpe2UoITApfSkub2ZmKFwibG9hZCBlcnJvclwiKS5hdHRyKFwicG9zdGVyXCIsYS5hdHRyKFwiZGF0YS1wb3N0ZXJcIikpLG8ubGVuZ3RoP28uZWFjaChzKTphLmF0dHIoXCJkYXRhLXNyY1wiKT8odC5lYWNoKGEuYXR0cihcImRhdGEtc3JjXCIpLnNwbGl0KFwiLFwiKSxmdW5jdGlvbihlLHIpe3ZhciBvPXIuc3BsaXQoXCJ8XCIpO2EuYXBwZW5kKHQoXCI8c291cmNlPlwiKS5vbmUoXCJlcnJvclwiLGMpLmF0dHIoe3NyYzpvWzBdLnRyaW0oKSx0eXBlOm9bMV0udHJpbSgpfSkpfSksdGhpcy5jb25maWcoXCJyZW1vdmVBdHRyaWJ1dGVcIikmJmEucmVtb3ZlQXR0cihcImRhdGEtc3JjXCIpKTplKCExKSxpLmxlbmd0aCYmaS5lYWNoKHMpfWVsc2UgZSghMSl9KX0od2luZG93LmpRdWVyeXx8d2luZG93LlplcHRvKSxmdW5jdGlvbih0KXt0LmxhenkoW1wiZnJhbWVcIixcImlmcmFtZVwiXSxcImlmcmFtZVwiLGZ1bmN0aW9uKGEsZSl7dmFyIHI9dGhpcztpZihcImlmcmFtZVwiPT09YVswXS50YWdOYW1lLnRvTG93ZXJDYXNlKCkpe3ZhciBvPWEuYXR0cihcImRhdGEtZXJyb3ItZGV0ZWN0XCIpO1widHJ1ZVwiIT09byYmXCIxXCIhPT1vPyhhLmF0dHIoXCJzcmNcIixhLmF0dHIoXCJkYXRhLXNyY1wiKSksci5jb25maWcoXCJyZW1vdmVBdHRyaWJ1dGVcIikmJmEucmVtb3ZlQXR0cihcImRhdGEtc3JjIGRhdGEtZXJyb3ItZGV0ZWN0XCIpKTp0LmFqYXgoe3VybDphLmF0dHIoXCJkYXRhLXNyY1wiKSxkYXRhVHlwZTpcImh0bWxcIixjcm9zc0RvbWFpbjohMCx4aHJGaWVsZHM6e3dpdGhDcmVkZW50aWFsczohMH0sc3VjY2VzczpmdW5jdGlvbih0KXthLmh0bWwodCkuYXR0cihcInNyY1wiLGEuYXR0cihcImRhdGEtc3JjXCIpKSxyLmNvbmZpZyhcInJlbW92ZUF0dHJpYnV0ZVwiKSYmYS5yZW1vdmVBdHRyKFwiZGF0YS1zcmMgZGF0YS1lcnJvci1kZXRlY3RcIil9LGVycm9yOmZ1bmN0aW9uKCl7ZSghMSl9fSl9ZWxzZSBlKCExKX0pfSh3aW5kb3cualF1ZXJ5fHx3aW5kb3cuWmVwdG8pLGZ1bmN0aW9uKHQpe3QubGF6eShcIm5vb3BcIixmdW5jdGlvbigpe30pLHQubGF6eShcIm5vb3Atc3VjY2Vzc1wiLGZ1bmN0aW9uKHQsYSl7YSghMCl9KSx0LmxhenkoXCJub29wLWVycm9yXCIsZnVuY3Rpb24odCxhKXthKCExKX0pfSh3aW5kb3cualF1ZXJ5fHx3aW5kb3cuWmVwdG8pLGZ1bmN0aW9uKHQpe2Z1bmN0aW9uIGEoYSxlLGkpe3ZhciBuPWEucHJvcChcImF0dHJpYnV0ZXNcIiksYz10KFwiPFwiK2UrXCI+XCIpO3JldHVybiB0LmVhY2gobixmdW5jdGlvbih0LGEpe1wic3Jjc2V0XCIhPT1hLm5hbWUmJmEubmFtZSE9PW98fChhLnZhbHVlPXIoYS52YWx1ZSxpKSksYy5hdHRyKGEubmFtZSxhLnZhbHVlKX0pLGEucmVwbGFjZVdpdGgoYyksY31mdW5jdGlvbiBlKGEsZSxyKXt2YXIgbz10KFwiPGltZz5cIikub25lKFwibG9hZFwiLGZ1bmN0aW9uKCl7cighMCl9KS5vbmUoXCJlcnJvclwiLGZ1bmN0aW9uKCl7cighMSl9KS5hcHBlbmRUbyhhKS5hdHRyKFwic3JjXCIsZSk7by5jb21wbGV0ZSYmby5sb2FkKCl9ZnVuY3Rpb24gcih0LGEpe2lmKGEpe3ZhciBlPXQuc3BsaXQoXCIsXCIpO3Q9XCJcIjtmb3IodmFyIHI9MCxvPWUubGVuZ3RoO3I8bztyKyspdCs9YStlW3JdLnRyaW0oKSsociE9PW8tMT9cIixcIjpcIlwiKX1yZXR1cm4gdH12YXIgbz1cImRhdGEtc3JjXCI7dC5sYXp5KFtcInBpY1wiLFwicGljdHVyZVwiXSxbXCJwaWN0dXJlXCJdLGZ1bmN0aW9uKGksbil7aWYoXCJwaWN0dXJlXCI9PT1pWzBdLnRhZ05hbWUudG9Mb3dlckNhc2UoKSl7dmFyIGM9aS5maW5kKG8pLHM9aS5maW5kKFwiZGF0YS1pbWdcIiksZD10aGlzLmNvbmZpZyhcImltYWdlQmFzZVwiKXx8XCJcIjtjLmxlbmd0aD8oYy5lYWNoKGZ1bmN0aW9uKCl7YSh0KHRoaXMpLFwic291cmNlXCIsZCl9KSwxPT09cy5sZW5ndGg/KHM9YShzLFwiaW1nXCIsZCkscy5vbihcImxvYWRcIixmdW5jdGlvbigpe24oITApfSkub24oXCJlcnJvclwiLGZ1bmN0aW9uKCl7bighMSl9KSxzLmF0dHIoXCJzcmNcIixzLmF0dHIobykpLHRoaXMuY29uZmlnKFwicmVtb3ZlQXR0cmlidXRlXCIpJiZzLnJlbW92ZUF0dHIobykpOmkuYXR0cihvKT8oZShpLGQraS5hdHRyKG8pLG4pLHRoaXMuY29uZmlnKFwicmVtb3ZlQXR0cmlidXRlXCIpJiZpLnJlbW92ZUF0dHIobykpOm4oITEpKTppLmF0dHIoXCJkYXRhLXNyY3NldFwiKT8odChcIjxzb3VyY2U+XCIpLmF0dHIoe21lZGlhOmkuYXR0cihcImRhdGEtbWVkaWFcIiksc2l6ZXM6aS5hdHRyKFwiZGF0YS1zaXplc1wiKSx0eXBlOmkuYXR0cihcImRhdGEtdHlwZVwiKSxzcmNzZXQ6cihpLmF0dHIoXCJkYXRhLXNyY3NldFwiKSxkKX0pLmFwcGVuZFRvKGkpLGUoaSxkK2kuYXR0cihvKSxuKSx0aGlzLmNvbmZpZyhcInJlbW92ZUF0dHJpYnV0ZVwiKSYmaS5yZW1vdmVBdHRyKG8rXCIgZGF0YS1zcmNzZXQgZGF0YS1tZWRpYSBkYXRhLXNpemVzIGRhdGEtdHlwZVwiKSk6bighMSl9ZWxzZSBuKCExKX0pfSh3aW5kb3cualF1ZXJ5fHx3aW5kb3cuWmVwdG8pLGZ1bmN0aW9uKHQpe3QubGF6eShbXCJqc1wiLFwiamF2YXNjcmlwdFwiLFwic2NyaXB0XCJdLFwic2NyaXB0XCIsZnVuY3Rpb24odCxhKXtcInNjcmlwdFwiPT09dFswXS50YWdOYW1lLnRvTG93ZXJDYXNlKCk/KHQuYXR0cihcInNyY1wiLHQuYXR0cihcImRhdGEtc3JjXCIpKSx0aGlzLmNvbmZpZyhcInJlbW92ZUF0dHJpYnV0ZVwiKSYmdC5yZW1vdmVBdHRyKFwiZGF0YS1zcmNcIikpOmEoITEpfSl9KHdpbmRvdy5qUXVlcnl8fHdpbmRvdy5aZXB0byksZnVuY3Rpb24odCl7dC5sYXp5KFwidmltZW9cIixmdW5jdGlvbih0LGEpe1wiaWZyYW1lXCI9PT10WzBdLnRhZ05hbWUudG9Mb3dlckNhc2UoKT8odC5hdHRyKFwic3JjXCIsXCJodHRwczovL3BsYXllci52aW1lby5jb20vdmlkZW8vXCIrdC5hdHRyKFwiZGF0YS1zcmNcIikpLHRoaXMuY29uZmlnKFwicmVtb3ZlQXR0cmlidXRlXCIpJiZ0LnJlbW92ZUF0dHIoXCJkYXRhLXNyY1wiKSk6YSghMSl9KX0od2luZG93LmpRdWVyeXx8d2luZG93LlplcHRvKSxmdW5jdGlvbih0KXt0LmxhenkoW1wieXRcIixcInlvdXR1YmVcIl0sZnVuY3Rpb24odCxhKXtpZihcImlmcmFtZVwiPT09dFswXS50YWdOYW1lLnRvTG93ZXJDYXNlKCkpe3ZhciBlPS8xfHRydWUvLnRlc3QodC5hdHRyKFwiZGF0YS1ub2Nvb2tpZVwiKSk7dC5hdHRyKFwic3JjXCIsXCJodHRwczovL3d3dy55b3V0dWJlXCIrKGU/XCItbm9jb29raWVcIjpcIlwiKStcIi5jb20vZW1iZWQvXCIrdC5hdHRyKFwiZGF0YS1zcmNcIikrXCI/cmVsPTAmYW1wO3Nob3dpbmZvPTBcIiksdGhpcy5jb25maWcoXCJyZW1vdmVBdHRyaWJ1dGVcIikmJnQucmVtb3ZlQXR0cihcImRhdGEtc3JjXCIpfWVsc2UgYSghMSl9KX0od2luZG93LmpRdWVyeXx8d2luZG93LlplcHRvKTsiLCI7IHZhciBsb2FkID0gKGZ1bmN0aW9uKHcsIGQsIHVuZGVmaW5lZCkge1xuXG4gIFwidXNlIHN0cmljdFwiO1xuICB2YXIgaXNfbm90X2xvYWRlZF95ZXQgPSB0cnVlO1xuICB2YXIgaW5pdCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBjbGFzc2VzID0gZG9jdW1lbnQuYm9keS5jbGFzc0xpc3Q7XG4gICAgZm9yICh2YXIgaSA9IGNsYXNzZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGlmKGNsYXNzZXNbaV0gPT0gXCJsb2FkZWRcIil7XG4gICAgICAgICAgaXNfbm90X2xvYWRlZF95ZXQgPSBmYWxzZTtcbiAgICAgIH07XG4gICAgfVxuICAgIGlmKGlzX25vdF9sb2FkZWRfeWV0KXtcbiAgICAgIGlzX25vdF9sb2FkZWRfeWV0ID0gZmFsc2U7XG4gICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7IGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0ICs9IFwiIGxvYWRlZFwiOyB9LCAzMDApO1xuICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpeyBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdCArPSBcIiBmYWRvdXRcIjsgfSwgNDUwKTtcbiAgICB9XG4gIH07XG5cbiAgZC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgaW5pdCk7XG5cbiAgcmV0dXJuIHtcbiAgICBpbml0OmluaXRcbiAgfTtcblxufSh3aW5kb3csIHdpbmRvdy5kb2N1bWVudCkpOyIsIihmdW5jdGlvbih3LCBkLCB1bmRlZmluZWQpIHtcblxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgaW5pdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBsb2FkLmluaXQoKTtcbiAgICAgICAgbmF2LmluaXQoKTtcbiAgICAgICAgaGVhZGVyLmluaXQoKTtcbiAgICAgICAgcGFnZXBvc2l0aW9uLmluaXQoKTtcbiAgICAgICAgbGF6eS5pbml0KCk7XG4gICAgfTtcblxuICAgIGQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIGluaXQpO1xuICAgIHcuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIGluaXQpO1xuXG59KHdpbmRvdywgd2luZG93LmRvY3VtZW50KSk7IiwiOyB2YXIgbGF6eSA9IChmdW5jdGlvbih3LCBkLCB1bmRlZmluZWQpIHtcblxuICAgIFwidXNlIHN0cmljdFwiO1xuICAgIHZhciBjdXJyZW50Zm9yY2UgPSBudWxsLCBwcmV2ID0gbnVsbCwgbmV4dCA9IG51bGw7XG4gICAgdmFyIGluaXQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgJCgnLmxhenknKS5MYXp5KHtcbiAgICAgICAgICAgIGJpbmQ6IFwiZXZlbnRcIixcbiAgICAgICAgICAgIHNjcm9sbERpcmVjdGlvbjogJ3ZlcnRpY2FsJyxcbiAgICAgICAgICAgIGVmZmVjdDogJ2ZhZGVJbicsXG4gICAgICAgICAgICB2aXNpYmxlT25seTogdHJ1ZSxcbiAgICAgICAgICAgIGFmdGVyTG9hZDogZnVuY3Rpb24oZWxlbWVudCkge1xuICAgICAgICAgICAgICAgIGVsZW1lbnQucGFyZW50KCkuYWRkQ2xhc3MoXCJsb2FkZWRcIik7XG4gICAgICAgICAgICB9LFxuICAgICAgICB9KS5wYXJlbnQoKS5jc3MoXCJwYWRkaW5nLXRvcFwiLCBcIjBcIilcblxuICAgICAgICAkKFwiaW1nLmxhenlcIikudW5iaW5kKCdjbGljaycpLmJpbmQoXCJjbGlja1wiLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGN1cnJlbnRmb3JjZSA9ICQodGhpcykuYXR0cignc3JjJyk7XG4gICAgICAgICAgICB2aWV3Zm9yY2UoY3VycmVudGZvcmNlKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgJChcIiN2aWV3Zm9yY2VcIikudW5iaW5kKCdjbGljaycpLmJpbmQoXCJjbGlja1wiLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBpZiAoZS50YXJnZXQgIT09IHRoaXMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgJChcIiN2aWV3Zm9yY2VcIikuY3NzKFwiZGlzcGxheVwiLCBcIm5vbmU7XCIpXG4gICAgICAgIH0pO1xuXG4gICAgICAgICQoXCIjbmV4dFwiKS51bmJpbmQoJ2NsaWNrJykuYmluZChcImNsaWNrXCIsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIGN1cnJlbnRmb3JjZSA9ICQoXCIjdmlld2ZvcmNlIGltZy52aWV3Zm9yY2VpbWFnZVwiKS5hdHRyKFwic3JjXCIpO1xuICAgICAgICAgICAgdmFyIG5leHQgPSAkKCdpbWcubGF6eVtzcmMqPVwiJyArIGN1cnJlbnRmb3JjZSArICdcIl0nKS5wYXJlbnQoJy5hbGJ1bUl0ZW0nKS5hdHRyKCdkYXRhLW5leHQnKTtcbiAgICAgICAgICAgIGlmIChuZXh0ID09ICcnKSB7IHJldHVybiB0cnVlO31cbiAgICAgICAgICAgIHZpZXdmb3JjZShuZXh0KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgJChcIiNwcmV2XCIpLnVuYmluZCgnY2xpY2snKS5iaW5kKFwiY2xpY2tcIiwgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgY3VycmVudGZvcmNlID0gJChcIiN2aWV3Zm9yY2UgaW1nLnZpZXdmb3JjZWltYWdlXCIpLmF0dHIoXCJzcmNcIik7XG4gICAgICAgICAgICB2YXIgcHJldiA9ICQoJ2ltZy5sYXp5W3NyYyo9XCInICsgY3VycmVudGZvcmNlICsgJ1wiXScpLnBhcmVudCgnLmFsYnVtSXRlbScpLmF0dHIoJ2RhdGEtcHJldicpO1xuICAgICAgICAgICAgaWYgKHByZXYgPT0gJycpIHsgcmV0dXJuIHRydWU7fVxuICAgICAgICAgICAgdmlld2ZvcmNlKHByZXYpO1xuICAgICAgICB9KTtcblxuICAgICAgICAkKFwiYm9keVwiKS51bmJpbmQoJ2tleWRvd24nKS5iaW5kKFwia2V5ZG93blwiLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBpZihlLmtleUNvZGUgPT0gMzcgfHwgZS5rZXlDb2RlID09IDM5KSB7IC8vIGxlZnRcbiAgICAgICAgICAgICAgICBjdXJyZW50Zm9yY2UgPSAkKFwiI3ZpZXdmb3JjZSBpbWcudmlld2ZvcmNlaW1hZ2VcIikuYXR0cihcInNyY1wiKTtcbiAgICAgICAgICAgICAgICBpZihlLmtleUNvZGUgPT0gMzcpIHsgLy8gbGVmdFxuICAgICAgICAgICAgICAgICAgICB2YXIgcHJldiA9ICQoJ2ltZy5sYXp5W3NyYyo9XCInICsgY3VycmVudGZvcmNlICsgJ1wiXScpLnBhcmVudCgnLmFsYnVtSXRlbScpLmF0dHIoJ2RhdGEtcHJldicpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocHJldiA9PSAnJykgeyByZXR1cm4gdHJ1ZTt9XG4gICAgICAgICAgICAgICAgICAgIHZpZXdmb3JjZShwcmV2KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZihlLmtleUNvZGUgPT0gMzkpIHsgLy8gcmlnaHRcbiAgICAgICAgICAgICAgICAgICAgdmFyIG5leHQgPSAkKCdpbWcubGF6eVtzcmMqPVwiJyArIGN1cnJlbnRmb3JjZSArICdcIl0nKS5wYXJlbnQoJy5hbGJ1bUl0ZW0nKS5hdHRyKCdkYXRhLW5leHQnKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5leHQgPT0gJycpIHsgcmV0dXJuIHRydWU7fVxuICAgICAgICAgICAgICAgICAgICB2aWV3Zm9yY2UobmV4dCk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHZhciB2aWV3Zm9yY2UgPSBmdW5jdGlvbihzcmMpe1xuICAgICAgICAkKFwiI3ZpZXdmb3JjZVwiKS5jc3MoXCJkaXNwbGF5XCIsIFwiYmxvY2tcIilcbiAgICAgICAgJChcIiN2aWV3Zm9yY2UgaW1nLnZpZXdmb3JjZWltYWdlXCIpLmF0dHIoXCJzcmNcIiwgc3JjKTtcblxuICAgICAgICAkKCdodG1sLCBib2R5JykuYW5pbWF0ZSh7XG4gICAgICAgICAgICBzY3JvbGxUb3A6ICQoJ2ltZy5sYXp5W3NyYyo9XCInICsgc3JjICsgJ1wiXScpLm9mZnNldCgpLnRvcFxuICAgICAgICB9LCAxMDApO1xuICAgIH1cblxuXG4gICAgZC5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgaW5pdCk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBpbml0OmluaXRcbiAgICB9O1xuXG59KHdpbmRvdywgd2luZG93LmRvY3VtZW50KSk7IiwiOyB2YXIgbmF2ID0gKGZ1bmN0aW9uKHcsIGQsIHVuZGVmaW5lZCkge1xuXG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIHZhciBpbml0ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHBhdGhuYW1lID0gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lO1xuICAgIHBhdGhuYW1lID0gcGF0aG5hbWUuc3BsaXQoXCIvXCIpO1xuICAgIHZhciAkb2JqID0gJChcIi5uYXYtbGlua1tkYXRhLXNsdWcqPSdcIiArIHBhdGhuYW1lWzFdICsgXCInXVwiKS5hZGRDbGFzcygnYWN0aXZlJyk7XG5cbiAgfTtcblxuICBkLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBpbml0KTtcblxuICByZXR1cm4ge1xuICAgIGluaXQ6aW5pdFxuICB9O1xuXG59KHdpbmRvdywgd2luZG93LmRvY3VtZW50KSk7IiwiOyB2YXIgcGFnZXBvc2l0aW9uID0gKGZ1bmN0aW9uKHcsIGQsIHVuZGVmaW5lZCkge1xuXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICB2YXIgaW5pdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3QgPSB3aW5kb3cucGFnZVlPZmZzZXQgfHwgZG9jdW1lbnQuYm9keS5zY3JvbGxUb3AgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFRvcCxcbiAgICAgICAgd2luZG93SGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0LFxuICAgICAgICBib2R5ID0gZG9jdW1lbnQuYm9keSxcbiAgICAgICAgaHRtbCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCxcbiAgICAgICAgaGVpZ2h0ID0gTWF0aC5tYXgoIGJvZHkuc2Nyb2xsSGVpZ2h0LCBib2R5Lm9mZnNldEhlaWdodCwgaHRtbC5jbGllbnRIZWlnaHQsIGh0bWwuc2Nyb2xsSGVpZ2h0LCBodG1sLm9mZnNldEhlaWdodCApLFxuICAgICAgICBwcm9jZW50ID0gLTEwMCAqIChzdCAvICh3aW5kb3dIZWlnaHQgLSBoZWlnaHQpKTtcblxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInBhZ2Vwb3NpdGlvblwiKS5zdHlsZS53aWR0aCA9IHByb2NlbnQgKyBcInZ3XCI7XG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwic2Nyb2xsXCIsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIHN0ID0gd2luZG93LnBhZ2VZT2Zmc2V0IHx8IGRvY3VtZW50LmJvZHkuc2Nyb2xsVG9wIHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxUb3AsXG4gICAgICAgICAgICB3aW5kb3dIZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQsXG4gICAgICAgICAgICBib2R5ID0gZG9jdW1lbnQuYm9keSxcbiAgICAgICAgICAgIGh0bWwgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsXG4gICAgICAgICAgICBoZWlnaHQgPSBNYXRoLm1heCggYm9keS5zY3JvbGxIZWlnaHQsIGJvZHkub2Zmc2V0SGVpZ2h0LCBodG1sLmNsaWVudEhlaWdodCwgaHRtbC5zY3JvbGxIZWlnaHQsIGh0bWwub2Zmc2V0SGVpZ2h0ICksXG4gICAgICAgICAgICBwcm9jZW50ID0gLTEwMCAqIChzdCAvICh3aW5kb3dIZWlnaHQgLSBoZWlnaHQpKTtcblxuICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJwYWdlcG9zaXRpb25cIikuc3R5bGUud2lkdGggPSBwcm9jZW50ICsgXCJ2d1wiO1xuICAgICAgICB9LCBmYWxzZSlcbiAgICB9O1xuXG4gICAgZC5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgaW5pdCk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBpbml0OmluaXRcbiAgICB9O1xuXG59KHdpbmRvdywgd2luZG93LmRvY3VtZW50KSk7IiwiOyB2YXIgaGVhZGVyID0gKGZ1bmN0aW9uKHcsIGQsIHVuZGVmaW5lZCkge1xuXG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIHZhciBpbml0ID0gZnVuY3Rpb24oKSB7XG4gICAgc2Nyb2xsaXQoKVxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwic2Nyb2xsXCIsIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHN0aGVhZGVyID0gd2luZG93LnBhZ2VZT2Zmc2V0IHx8IGRvY3VtZW50LmJvZHkuc2Nyb2xsVG9wIHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxUb3AsXG4gICAgICBoZWFkZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnLmhlYWRlcjpub3QoLnNocmluayknICk7XG4gICAgICBpZiAoc3RoZWFkZXIgPj0gMSkge1xuICAgICAgICBpZiAoaGVhZGVyWzBdICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGhlYWRlclswXS5jbGFzc05hbWUgKz0gJyBzaHJpbmsnO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBoZWFkZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnLmhlYWRlcicgKTtcbiAgICAgICAgaWYgKGhlYWRlclswXSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBoZWFkZXJbMF0uY2xhc3NOYW1lID0gJ2hlYWRlcic7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LCBmYWxzZSk7XG5cbiAgfSxcbiAgc2Nyb2xsaXQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc3RoZWFkZXIgPSB3aW5kb3cucGFnZVlPZmZzZXQgfHwgZG9jdW1lbnQuYm9keS5zY3JvbGxUb3AgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFRvcCxcbiAgICBoZWFkZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnLmhlYWRlcjpub3QoLnNocmluayknICk7XG4gICAgaWYgKHN0aGVhZGVyID49IDIpIHtcbiAgICAgIGlmIChoZWFkZXJbMF0gIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGhlYWRlclswXS5jbGFzc05hbWUgKz0gJyBzaHJpbmsnO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBoZWFkZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnLmhlYWRlcicgKTtcbiAgICAgIGlmIChoZWFkZXJbMF0gIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGhlYWRlclswXS5jbGFzc05hbWUgPSAnaGVhZGVyJztcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgZC5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgaW5pdCk7XG5cbiAgcmV0dXJuIHtcbiAgICBpbml0OmluaXRcbiAgfTtcblxufSh3aW5kb3csIHdpbmRvdy5kb2N1bWVudCkpOyJdfQ==
