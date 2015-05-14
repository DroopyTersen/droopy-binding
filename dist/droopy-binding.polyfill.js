(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
var polyfill = require("object.observe");
global.droopyBinding = {};
global.DroopyBinding = require("../src/droopyBinding");
exports.DroopyBinding = global.DroopyBinding;
}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../src/droopyBinding":6,"object.observe":4}],2:[function(require,module,exports){
var EventAggregator = function() {
	this.eventKeys = {};
	this.lastSubscriptionId = -1;
};

EventAggregator.prototype.on = function(key, callback) {
	if (typeof callback === "function") {
		if (!this.eventKeys[key]) {
			this.eventKeys[key] = {
				subscriptions: {}
			};
		}
		var token = (++this.lastSubscriptionId).toString();
		this.eventKeys[key].subscriptions[token] = callback;
		return token;
	} else {
		return false;
	}
};

EventAggregator.prototype.off = function(key, tokenOrCallback) {
	if (typeof tokenOrCallback === 'function') {
		//Callback reference was passed in so find the subscription with the matching function
		if (this.eventKeys[key]) {
			var eventSubscriptions = this.eventKeys[key].subscriptions;
			var matchingId = null;
			//foreach subscription see if the functions match and save the key if yes
			for (var subscriptionId in eventSubscriptions) {
				if (eventSubscriptions.hasOwnProperty(subscriptionId)) {
					if (eventSubscriptions[subscriptionId] === tokenOrCallback) {
						matchingId = subscriptionId;
					}
				}
			}
			if (matchingId !== null) {
				delete eventSubscriptions[matchingId];
			}
		}
	} else {
		//Token was passed in
		if (this.eventKeys[key] && this.eventKeys[key].subscriptions[tokenOrCallback]) {
			delete this.eventKeys[key].subscriptions[tokenOrCallback];
		}
	}
};

EventAggregator.prototype.trigger = function(key) {
	var self = this;
	if (self.eventKeys[key]) {
		var values = Array.prototype.slice.call(arguments, 1);
		//If passing less than values pass them individually
		var a1 = values[0],
			a2 = values[1],
			a3 = values[2];
		//Else if passing more than 3 values group as an args array
		if (values.length > 3) {
			a1 = values;
		}

		var subscriptions = self.eventKeys[key].subscriptions;
		setTimeout(function() {
			for (var token in subscriptions) {
				if (subscriptions.hasOwnProperty(token)) {
					subscriptions[token](a1, a2, a3);
				}
			}
		}, 0);
	}
};

module.exports = EventAggregator;
},{}],3:[function(require,module,exports){
var templating = {

	Placeholder: function(raw) {
		this.raw = raw;
		this.fullProperty = raw.slice(2, raw.length - 2);
	},

	getPlaceHolders: function(template, regexp) {
		var regExpPattern = regexp || /\{\{[^\}]+\}\}?/g;
		var matches = template.match(regExpPattern);
		return matches || [];
	},

	getObjectValue: function(obj, fullProperty) {
		var value = obj,
			propertyChain = fullProperty.split('.');

		for (var i = 0; i < propertyChain.length; i++) {
			var property = propertyChain[i];
			value = value[property] != null ? value[property] : "Not Found: " + fullProperty;
		}

		if(fullProperty === "_") {
			value = obj;
		}
		
		if ((typeof value === "string") && value.indexOf("/Date(") !== -1) {
			var dateValue = UTCJsonToDate(value);
			value = dateValue.toLocaleDateString();
		}

		return value;
	},

	populateTemplate: function(template, item, regexp) {
		var placeholders = this.getPlaceHolders(template, regexp) || [],
			itemHtml = template;

		for (var i = 0; i < placeholders.length; i++) {
			var placeholder = new this.Placeholder(placeholders[i]);
			placeholder.val = this.getObjectValue(item, placeholder.fullProperty);
			var pattern = placeholder.raw.replace("[", "\\[").replace("]", "\\]");
			var modifier = "g";
			itemHtml = itemHtml.replace(new RegExp(pattern, modifier), placeholder.val);
		}
		return itemHtml;
	}
};

templating.Each = {

	regExp: /\{\[[^\]]+\]\}?/g,

	populateEachTemplates: function(itemHtml, item) {
		var $itemHtml = $(itemHtml),
			eachTemplates = $itemHtml.find("[data-each]");

		eachTemplates.each(function() {
			var arrayHtml = "",
				itemTemplate = $(this).html(),
				arrayProp = $(this).data("each"),
				array = sp.templating.getObjectValue(item, arrayProp);

			if (array != null && $.isArray(array)) {
				for (var i = 0; i < array.length; i++) {
					arrayHtml += templating.populateTemplate(itemTemplate, array[i], templating.Each.regExp);
				}
			}

			$itemHtml.find($(this)).html(arrayHtml);
		});

		var temp = $itemHtml.clone().wrap("<div>");
		return temp.parent().html();
	}
};

templating.renderTemplate = function(template, item, renderEachTemplate) {
	var itemHtml = templating.populateTemplate(template, item);
	if (renderEachTemplate) {
		itemHtml = templating.Each.populateEachTemplates(itemHtml, item);
	}
	return itemHtml;
};

var UTCJsonToDate = function(jsonDate) {
	var utcStr = jsonDate.substring(jsonDate.indexOf("(") + 1);
	utcStr = utcStr.substring(0, utcStr.indexOf(")"));

	var returnDate = new Date(parseInt(utcStr, 10));
	var hourOffset = returnDate.getTimezoneOffset() / 60;
	returnDate.setHours(returnDate.getHours() + hourOffset);

	return returnDate;
};

module.exports = templating;
},{}],4:[function(require,module,exports){
/*!
 * Object.observe polyfill - v0.2.3
 * by Massimo Artizzu (MaxArt2501)
 * 
 * https://github.com/MaxArt2501/object-observe
 * 
 * Licensed under the MIT License
 * See LICENSE for details
 */

// Some type definitions
/**
 * This represents the data relative to an observed object
 * @typedef  {Object}                     ObjectData
 * @property {Map<Handler, HandlerData>}  handlers
 * @property {String[]}                   properties
 * @property {*[]}                        values
 * @property {Descriptor[]}               descriptors
 * @property {Notifier}                   notifier
 * @property {Boolean}                    frozen
 * @property {Boolean}                    extensible
 * @property {Object}                     proto
 */
/**
 * Function definition of a handler
 * @callback Handler
 * @param {ChangeRecord[]}                changes
*/
/**
 * This represents the data relative to an observed object and one of its
 * handlers
 * @typedef  {Object}                     HandlerData
 * @property {Map<Object, ObservedData>}  observed
 * @property {ChangeRecord[]}             changeRecords
 */
/**
 * @typedef  {Object}                     ObservedData
 * @property {String[]}                   acceptList
 * @property {ObjectData}                 data
*/
/**
 * Type definition for a change. Any other property can be added using
 * the notify() or performChange() methods of the notifier.
 * @typedef  {Object}                     ChangeRecord
 * @property {String}                     type
 * @property {Object}                     object
 * @property {String}                     [name]
 * @property {*}                          [oldValue]
 * @property {Number}                     [index]
 */
/**
 * Type definition for a notifier (what Object.getNotifier returns)
 * @typedef  {Object}                     Notifier
 * @property {Function}                   notify
 * @property {Function}                   performChange
 */
/**
 * Function called with Notifier.performChange. It may optionally return a
 * ChangeRecord that gets automatically notified, but `type` and `object`
 * properties are overridden.
 * @callback Performer
 * @returns {ChangeRecord|undefined}
 */

Object.observe || (function(O, A, root) {
    "use strict";

        /**
         * Relates observed objects and their data
         * @type {Map<Object, ObjectData}
         */
    var observed,
        /**
         * List of handlers and their data
         * @type {Map<Handler, Map<Object, HandlerData>>}
         */
        handlers,

        defaultAcceptList = [ "add", "update", "delete", "reconfigure", "setPrototype", "preventExtensions" ];

    // Functions for internal usage

        /**
         * Checks if the argument is an Array object. Polyfills Array.isArray.
         * @function isArray
         * @param {?*} object
         * @returns {Boolean}
         */
    var isArray = A.isArray || (function(toString) {
            return function (object) { return toString.call(object) === "[object Array]"; };
        })(O.prototype.toString),

        /**
         * Returns the index of an item in a collection, or -1 if not found.
         * Uses the generic Array.indexOf or Array.prototype.indexOf if available.
         * @function inArray
         * @param {Array} array
         * @param {*} pivot           Item to look for
         * @param {Number} [start=0]  Index to start from
         * @returns {Number}
         */
        inArray = A.prototype.indexOf ? A.indexOf || function(array, pivot, start) {
            return A.prototype.indexOf.call(array, pivot, start);
        } : function(array, pivot, start) {
            for (var i = start || 0; i < array.length; i++)
                if (array[i] === pivot)
                    return i;
            return -1;
        },

        /**
         * Returns an instance of Map, or a Map-like object is Map is not
         * supported or doesn't support forEach()
         * @function createMap
         * @returns {Map}
         */
        createMap = typeof root.Map === "undefined" || !Map.prototype.forEach ? function() {
            // Lightweight shim of Map. Lacks clear(), entries(), keys() and
            // values() (the last 3 not supported by IE11, so can't use them),
            // it doesn't handle the constructor's argument (like IE11) and of
            // course it doesn't support for...of.
            // Chrome 31-35 and Firefox 13-24 have a basic support of Map, but
            // they lack forEach(), so their native implementation is bad for
            // this polyfill. (Chrome 36+ supports Object.observe.)
            var keys = [], values = [];

            return {
                size: 0,
                has: function(key) { return inArray(keys, key) > -1; },
                get: function(key) { return values[inArray(keys, key)]; },
                set: function(key, value) {
                    var i = inArray(keys, key);
                    if (i === -1) {
                        keys.push(key);
                        values.push(value);
                        this.size++;
                    } else values[i] = value;
                },
                "delete": function(key) {
                    var i = inArray(keys, key);
                    if (i > -1) {
                        keys.splice(i, 1);
                        values.splice(i, 1);
                        this.size--;
                    }
                },
                forEach: function(callback/*, thisObj*/) {
                    for (var i = 0; i < keys.length; i++)
                        callback.call(arguments[1], values[i], keys[i], this);
                }
            };
        } : function() { return new Map(); },

        /**
         * Simple shim for Object.getOwnPropertyNames when is not available
         * Misses checks on object, don't use as a replacement of Object.keys/getOwnPropertyNames
         * @function getProps
         * @param {Object} object
         * @returns {String[]}
         */
        getProps = O.getOwnPropertyNames ? (function() {
            var func = O.getOwnPropertyNames;
            try {
                arguments.callee;
            } catch (e) {
                // Strict mode is supported

                // In strict mode, we can't access to "arguments", "caller" and
                // "callee" properties of functions. Object.getOwnPropertyNames
                // returns [ "prototype", "length", "name" ] in Firefox; it returns
                // "caller" and "arguments" too in Chrome and in Internet
                // Explorer, so those values must be filtered.
                var avoid = (func(inArray).join(" ") + " ").replace(/prototype |length |name /g, "").slice(0, -1).split(" ");
                if (avoid.length) func = function(object) {
                    var props = O.getOwnPropertyNames(object);
                    if (typeof object === "function")
                        for (var i = 0, j; i < avoid.length;)
                            if ((j = inArray(props, avoid[i++])) > -1)
                                props.splice(j, 1);

                    return props;
                };
            }
            return func;
        })() : function(object) {
            // Poor-mouth version with for...in (IE8-)
            var props = [], prop, hop;
            if ("hasOwnProperty" in object) {
                for (prop in object)
                    if (object.hasOwnProperty(prop))
                        props.push(prop);
            } else {
                hop = O.hasOwnProperty;
                for (prop in object)
                    if (hop.call(object, prop))
                        props.push(prop);
            }

            // Inserting a common non-enumerable property of arrays
            if (isArray(object))
                props.push("length");

            return props;
        },

        /**
         * Return the prototype of the object... if defined.
         * @function getPrototype
         * @param {Object} object
         * @returns {Object}
         */
        getPrototype = O.getPrototypeOf,

        /**
         * Return the descriptor of the object... if defined.
         * IE8 supports a (useless) Object.getOwnPropertyDescriptor for DOM
         * nodes only, so defineProperties is checked instead.
         * @function getDescriptor
         * @param {Object} object
         * @param {String} property
         * @returns {Descriptor}
         */
        getDescriptor = O.defineProperties && O.getOwnPropertyDescriptor,

        /**
         * Sets up the next check and delivering iteration, using
         * requestAnimationFrame or a (close) polyfill.
         * @function nextFrame
         * @param {function} func
         * @returns {number}
         */
        nextFrame = root.requestAnimationFrame || root.webkitRequestAnimationFrame || (function() {
            var initial = +new Date,
                last = initial;
            return function(func) {
                var now = +new Date;
                return setTimeout(function() {
                    func((last = +new Date) - initial);
                }, 17);
            };
        })(),

        /**
         * Sets up the observation of an object
         * @function doObserve
         * @param {Object} object
         * @param {Handler} handler
         * @param {String[]} [acceptList]
         */
        doObserve = function(object, handler, acceptList) {

            var data = observed.get(object);

            if (data)
                setHandler(object, data, handler, acceptList);
            else {
                data = createObjectData(object);
                setHandler(object, data, handler, acceptList);
                
                if (observed.size === 1)
                    // Let the observation begin!
                    nextFrame(runGlobalLoop);
            }
        },

        /**
         * Creates the initial data for an observed object
         * @function createObjectData
         * @param {Object} object
         */
        createObjectData = function(object, data) {
            var props = getProps(object),
                values = [], descs, i = 0,
                data = {
                    handlers: createMap(),
                    frozen: O.isFrozen ? O.isFrozen(object) : false,
                    extensible: O.isExtensible ? O.isExtensible(object) : true,
                    proto: getPrototype && getPrototype(object),
                    properties: props,
                    values: values,
                    notifier: retrieveNotifier(object, data)
                };

            if (getDescriptor) {
                descs = data.descriptors = [];
                while (i < props.length) {
                    descs[i] = getDescriptor(object, props[i]);
                    values[i] = object[props[i++]];
                }
            } else while (i < props.length)
                values[i] = object[props[i++]];

            observed.set(object, data);

            return data;
        },

        /**
         * Performs basic property value change checks on an observed object
         * @function performPropertyChecks
         * @param {ObjectData} data
         * @param {Object} object
         * @param {String} [except]  Doesn't deliver the changes to the
         *                           handlers that accept this type
         */
        performPropertyChecks = (function() {
            var updateCheck = getDescriptor ? function(object, data, idx, except, descr) {
                var key = data.properties[idx],
                    value = object[key],
                    ovalue = data.values[idx],
                    odesc = data.descriptors[idx];

                if ("value" in descr && (ovalue === value
                        ? ovalue === 0 && 1/ovalue !== 1/value 
                        : ovalue === ovalue || value === value)) {
                    addChangeRecord(object, data, {
                        name: key,
                        type: "update",
                        object: object,
                        oldValue: ovalue
                    }, except);
                    data.values[idx] = value;
                }
                if (odesc.configurable && (!descr.configurable
                        || descr.writable !== odesc.writable
                        || descr.enumerable !== odesc.enumerable
                        || descr.get !== odesc.get
                        || descr.set !== odesc.set)) {
                    addChangeRecord(object, data, {
                        name: key,
                        type: "reconfigure",
                        object: object,
                        oldValue: ovalue
                    }, except);
                    data.descriptors[idx] = descr;
                }
            } : function(object, data, idx, except) {
                var key = data.properties[idx],
                    value = object[key],
                    ovalue = data.values[idx];

                if (ovalue === value ? ovalue === 0 && 1/ovalue !== 1/value 
                        : ovalue === ovalue || value === value) {
                    addChangeRecord(object, data, {
                        name: key,
                        type: "update",
                        object: object,
                        oldValue: ovalue
                    }, except);
                    data.values[idx] = value;
                }
            };

            // Checks if some property has been deleted
            var deletionCheck = getDescriptor ? function(object, props, proplen, data, except) {
                var i = props.length, descr;
                while (proplen && i--) {
                    if (props[i] !== null) {
                        descr = getDescriptor(object, props[i]);
                        proplen--;

                        // If there's no descriptor, the property has really
                        // been deleted; otherwise, it's been reconfigured so
                        // that's not enumerable anymore
                        if (descr) updateCheck(object, data, i, except, descr);
                        else {
                            addChangeRecord(object, data, {
                                name: props[i],
                                type: "delete",
                                object: object,
                                oldValue: data.values[i]
                            }, except);
                            data.properties.splice(i, 1);
                            data.values.splice(i, 1);
                            data.descriptors.splice(i, 1);
                        }
                    }
                }
            } : function(object, props, proplen, data, except) {
                var i = props.length;
                while (proplen && i--)
                    if (props[i] !== null) {
                        addChangeRecord(object, data, {
                            name: props[i],
                            type: "delete",
                            object: object,
                            oldValue: data.values[i]
                        }, except);
                        data.properties.splice(i, 1);
                        data.values.splice(i, 1);
                        proplen--;
                    }
            };

            return function(data, object, except) {
                if (!data.handlers.size || data.frozen) return;

                var props, proplen, keys,
                    values = data.values,
                    descs = data.descriptors,
                    i = 0, idx,
                    key, value,
                    proto, descr;

                // If the object isn't extensible, we don't need to check for new
                // or deleted properties
                if (data.extensible) {

                    props = data.properties.slice();
                    proplen = props.length;
                    keys = getProps(object);

                    if (descs) {
                        while (i < keys.length) {
                            key = keys[i++];
                            idx = inArray(props, key);
                            descr = getDescriptor(object, key);

                            if (idx === -1) {
                                addChangeRecord(object, data, {
                                    name: key,
                                    type: "add",
                                    object: object
                                }, except);
                                data.properties.push(key);
                                values.push(object[key]);
                                descs.push(descr);
                            } else {
                                props[idx] = null;
                                proplen--;
                                updateCheck(object, data, idx, except, descr);
                            }
                        }
                        deletionCheck(object, props, proplen, data, except);

                        if (!O.isExtensible(object)) {
                            data.extensible = false;
                            addChangeRecord(object, data, {
                                type: "preventExtensions",
                                object: object
                            }, except);

                            data.frozen = O.isFrozen(object);
                        }
                    } else {
                        while (i < keys.length) {
                            key = keys[i++];
                            idx = inArray(props, key);
                            value = object[key];

                            if (idx === -1) {
                                addChangeRecord(object, data, {
                                    name: key,
                                    type: "add",
                                    object: object
                                }, except);
                                data.properties.push(key);
                                values.push(value);
                            } else {
                                props[idx] = null;
                                proplen--;
                                updateCheck(object, data, idx, except);
                            }
                        }
                        deletionCheck(object, props, proplen, data, except);
                    }

                } else if (!data.frozen) {

                    // If the object is not extensible, but not frozen, we just have
                    // to check for value changes
                    for (; i < props.length; i++) {
                        key = props[i];
                        updateCheck(object, data, i, except, getDescriptor(object, key));
                    }

                    if (O.isFrozen(object))
                        data.frozen = true;
                }

                if (getPrototype) {
                    proto = getPrototype(object);
                    if (proto !== data.proto) {
                        addChangeRecord(object, data, {
                            type: "setPrototype",
                            name: "__proto__",
                            object: object,
                            oldValue: data.proto
                        });
                        data.proto = proto;
                    }
                }
            };
        })(),

        /**
         * Sets up the main loop for object observation and change notification
         * It stops if no object is observed.
         * @function runGlobalLoop
         */
        runGlobalLoop = function() {
            if (observed.size) {
                observed.forEach(performPropertyChecks);
                handlers.forEach(deliverHandlerRecords);
                nextFrame(runGlobalLoop);
            }
        },

        /**
         * Deliver the change records relative to a certain handler, and resets
         * the record list.
         * @param {HandlerData} hdata
         * @param {Handler} handler
         */
        deliverHandlerRecords = function(hdata, handler) {
            if (hdata.changeRecords.length) {
                handler(hdata.changeRecords);
                hdata.changeRecords = [];
            }
        },

        /**
         * Returns the notifier for an object - whether it's observed or not
         * @function retrieveNotifier
         * @param {Object} object
         * @param {ObjectData} [data]
         * @returns {Notifier}
         */
        retrieveNotifier = function(object, data) {
            if (arguments.length < 2)
                data = observed.get(object);

            /** @type {Notifier} */
            return data && data.notifier || {
                /**
                 * @method notify
                 * @see http://arv.github.io/ecmascript-object-observe/#notifierprototype._notify
                 * @memberof Notifier
                 * @param {ChangeRecord} changeRecord
                 */
                notify: function(changeRecord) {
                    changeRecord.type; // Just to check the property is there...

                    // If there's no data, the object has been unobserved
                    var data = observed.get(object);
                    if (data) {
                        var recordCopy = { object: object }, prop;
                        for (prop in changeRecord)
                            if (prop !== "object")
                                recordCopy[prop] = changeRecord[prop];
                        addChangeRecord(object, data, recordCopy);
                    }
                },

                /**
                 * @method performChange
                 * @see http://arv.github.io/ecmascript-object-observe/#notifierprototype_.performchange
                 * @memberof Notifier
                 * @param {String} changeType
                 * @param {Performer} func     The task performer
                 * @param {*} [thisObj]        Used to set `this` when calling func
                 */
                performChange: function(changeType, func/*, thisObj*/) {
                    if (typeof changeType !== "string")
                        throw new TypeError("Invalid non-string changeType");

                    if (typeof func !== "function")
                        throw new TypeError("Cannot perform non-function");

                    // If there's no data, the object has been unobserved
                    var data = observed.get(object),
                        prop, changeRecord,
                        result = func.call(arguments[2]);

                    data && performPropertyChecks(data, object, changeType);

                    // If there's no data, the object has been unobserved
                    if (data && result && typeof result === "object") {
                        changeRecord = { object: object, type: changeType };
                        for (prop in result)
                            if (prop !== "object" && prop !== "type")
                                changeRecord[prop] = result[prop];
                        addChangeRecord(object, data, changeRecord);
                    }
                }
            };
        },

        /**
         * Register (or redefines) an handler in the collection for a given
         * object and a given type accept list.
         * @function setHandler
         * @param {Object} object
         * @param {ObjectData} data
         * @param {Handler} handler
         * @param {String[]} acceptList
         */
        setHandler = function(object, data, handler, acceptList) {
            var hdata = handlers.get(handler), odata;
            if (!hdata)
                handlers.set(handler, hdata = {
                    observed: createMap(),
                    changeRecords: []
                });
            hdata.observed.set(object, {
                acceptList: acceptList.slice(),
                data: data
            });
            data.handlers.set(handler, hdata);
        },

        /**
         * Adds a change record in a given ObjectData
         * @function addChangeRecord
         * @param {Object} object
         * @param {ObjectData} data
         * @param {ChangeRecord} changeRecord
         * @param {String} [except]
         */
        addChangeRecord = function(object, data, changeRecord, except) {
            data.handlers.forEach(function(hdata) {
                var acceptList = hdata.observed.get(object).acceptList;
                // If except is defined, Notifier.performChange has been
                // called, with except as the type.
                // All the handlers that accepts that type are skipped.
                if ((typeof except !== "string"
                        || inArray(acceptList, except) === -1)
                        && inArray(acceptList, changeRecord.type) > -1)
                    hdata.changeRecords.push(changeRecord);
            });
        };

    observed = createMap();
    handlers = createMap();

    /**
     * @function Object.observe
     * @see http://arv.github.io/ecmascript-object-observe/#Object.observe
     * @param {Object} object
     * @param {Handler} handler
     * @param {String[]} [acceptList]
     * @throws {TypeError}
     * @returns {Object}               The observed object
     */
    O.observe = function observe(object, handler, acceptList) {
        if (!object || typeof object !== "object" && typeof object !== "function")
            throw new TypeError("Object.observe cannot observe non-object");

        if (typeof handler !== "function")
            throw new TypeError("Object.observe cannot deliver to non-function");

        if (O.isFrozen && O.isFrozen(handler))
            throw new TypeError("Object.observe cannot deliver to a frozen function object");

        if (arguments.length > 2) {
            if (!acceptList || typeof acceptList !== "object")
                throw new TypeError("Object.observe cannot use non-object accept list");
        } else acceptList = defaultAcceptList;

        doObserve(object, handler, acceptList);

        return object;
    };

    /**
     * @function Object.unobserve
     * @see http://arv.github.io/ecmascript-object-observe/#Object.unobserve
     * @param {Object} object
     * @param {Handler} handler
     * @throws {TypeError}
     * @returns {Object}         The given object
     */
    O.unobserve = function unobserve(object, handler) {
        if (object === null || typeof object !== "object" && typeof object !== "function")
            throw new TypeError("Object.unobserve cannot unobserve non-object");

        if (typeof handler !== "function")
            throw new TypeError("Object.unobserve cannot deliver to non-function");

        var hdata = handlers.get(handler), odata;

        if (hdata && (odata = hdata.observed.get(object))) {
            hdata.observed.forEach(function(odata, object) {
                performPropertyChecks(odata.data, object);
            });
            nextFrame(function() {
                deliverHandlerRecords(hdata, handler);
            });

            // In Firefox 13-18, size is a function, but createMap should fall
            // back to the shim for those versions
            if (hdata.observed.size === 1 && hdata.observed.has(object))
                handlers["delete"](handler);
            else hdata.observed["delete"](object);

            if (odata.data.handlers.size === 1)
                observed["delete"](object);
            else odata.data.handlers["delete"](handler);
        }

        return object;
    };

    /**
     * @function Object.getNotifier
     * @see http://arv.github.io/ecmascript-object-observe/#GetNotifier
     * @param {Object} object
     * @throws {TypeError}
     * @returns {Notifier}
     */
    O.getNotifier = function getNotifier(object) {
        if (object === null || typeof object !== "object" && typeof object !== "function")
            throw new TypeError("Object.getNotifier cannot getNotifier non-object");

        if (O.isFrozen && O.isFrozen(object)) return null;

        return retrieveNotifier(object);
    };

    /**
     * @function Object.deliverChangeRecords
     * @see http://arv.github.io/ecmascript-object-observe/#Object.deliverChangeRecords
     * @see http://arv.github.io/ecmascript-object-observe/#DeliverChangeRecords
     * @param {Handler} handler
     * @throws {TypeError}
     */
    O.deliverChangeRecords = function deliverChangeRecords(handler) {
        if (typeof handler !== "function")
            throw new TypeError("Object.deliverChangeRecords cannot deliver to non-function");

        var hdata = handlers.get(handler);
        if (hdata) {
            hdata.observed.forEach(function(odata, object) {
                performPropertyChecks(odata.data, object);
            });
            deliverHandlerRecords(hdata, handler);
        }
    };

})(Object, Array, this);
},{}],5:[function(require,module,exports){
var templating = require("droopy-templating");

var ArrayBinding = function(element, fullProperty) {
	this.element = element;
	this.original = element.innerHTML;
	this.fullProperty = fullProperty;
};

ArrayBinding.prototype.update = function(scope) {
	var self = this;
	var arrayHtml = "";
	var array = templating.getObjectValue(scope, self.fullProperty);

	if (array && Array.isArray(array)) {
		for (var i = 0; i < array.length; i++) {
			arrayHtml += templating.populateTemplate(self.original, array[i], templating.Each.regExp);
		}
	}
	self.element.innerHTML = arrayHtml;
};

module.exports = ArrayBinding;
},{"droopy-templating":3}],6:[function(require,module,exports){
var templating = require("droopy-templating");
var NodeBinding = require("./nodeBinding");
var ArrayBinding = require("./arrayBinding");

var DroopyBinding = function(containerId, model, shouldInit) {
	this.model = model;
	this.container = document.getElementById(containerId);

	//Get all bindings
	this.bindings = this.getBindings(this.container);

	if (shouldInit !== false) {
		this.init();
	}
};

DroopyBinding.prototype.init = function() {
	var self = this;
	self.updateBindings();
	self.recursiveObserve(self.model, "", function(changes, propChain) {
		self.handleObjectChange(changes, propChain);
	});
};

DroopyBinding.prototype.recursiveObserve = function(obj, propChain, callback) {
	var self = this;
	// Make sure its an array or object
	if (!Array.isArray(obj) && typeof obj !== "object") return;

	if (Array.isArray(obj)) {
		if (Array.observe) {
			Array.observe(obj, function(changes) {
				self.handleArrayChange(changes, propChain);
			});			
		} else {
			Object.observe(obj, function(changes) {
				self.handleArrayChange(changes, propChain);
			});	
		}
		// Recursively observe any array items
		obj.forEach(function(arrayItem, i){
			self.recursiveObserve(arrayItem, "", function(changes) { 
				self.handleArrayChange.call(self, changes, propChain);
			});
		});

	} else {
		Object.observe(obj, function(changes) {
			callback(changes, propChain);
		});
		
		// Recursively observe any child objects
		Object.keys(obj).forEach(function(propName) {
			var newPropChain = propChain;
			if (newPropChain) {
				newPropChain += "." + propName;
			} else {
				newPropChain = propName;
			}
			self.recursiveObserve(obj[propName], newPropChain, callback);
		});
	}
	
};

DroopyBinding.prototype.handleArrayChange = function(changes, propChain) {
	var self = this;

	// Re-observe any new objects
	changes.forEach(function(change){
		//If its an array change, and an update, its a new index assignment so re-observe
		if (Array.isArray(change.object) && change.type === "update") {
			self.recursiveObserve(change.object[change.name], "", function(changes) { 
				self.handleArrayChange.call(self, changes, propChain);
			});
		} 
		// If its a push or a pop it will come through as splice
		else if (Array.isArray(change.object) && change.type === "splice") {
			// If its a push, addedCount will be 1
			if (change.addedCount > 0) {
				// start observing the new array item
				self.recursiveObserve(change.object[change.index], "", function(changes) { 
					self.handleArrayChange.call(self, changes, propChain);
				});
			}
			// If its a pop we really don't care here because there is nothing to re-observe
		}
	});
	// Rerender data-each bindings that are tied to the array
	self.bindings.forEach(function(binding) {
		if (binding.fullProperty === propChain) {
			binding.update(self.model);
		}
	});
};

var _findBindings = function(bindings, property) {
	return bindings.filter(function(binding) {
		return (binding.fullProperty.indexOf(property) === 0)
	});
};

DroopyBinding.prototype.handleObjectChange = function(changes, propChain) {
	var self = this;
	changes.forEach(function(change) {
		// Get the property chain string to tie back to UI placeholder
		var changedProp = change.name;
		if (propChain) {
			changedProp = propChain + "." + change.name;
		}

		// Check each binding to see if it cares, update if it does
		_findBindings(self.bindings, changedProp).forEach(function(binding){
			binding.update(self.model);
		});

		// If object gets overwritten, need to re-observe it
		if (change.type === "update") {
			self.recursiveObserve(change.object[change.name], changedProp, function(changes, propChain) {
				self.handleObjectChange(changes, propChain);
			});
		}
	});
};

DroopyBinding.prototype.updateBindings = function() {
	var self = this;
	self.bindings.forEach(function(binding) {
		binding.update(self.model);
	});
};

DroopyBinding.prototype.updateModelProperty = function(fullProperty, newValue) {
	//start with the model
	var propertyChain = fullProperty.split('.');
	var parentObj = this.model;
	var property = fullProperty;
	//traverse the property chain, except for last one
	for (var i = 0; i < propertyChain.length - 1; i++) {
		if (parentObj[propertyChain[i]] != null) {
			property = propertyChain[i];
			parentObj = parentObj[property];
		} 
	}
	//if its an underscore, its referencing the model scope
	if(fullProperty === "_") {
		parentObj = newValue;
	} else {
		property = propertyChain[propertyChain.length - 1];
		parentObj[property] = newValue;
	}
};

DroopyBinding.prototype.updateModel = function(newModel) {
	this.model = newModel;
	this.init();
};

DroopyBinding.prototype.getBindings = function(element) {
	var self = this;
	var bindings = [];
	var placeholders = [];
	var i = 0;
	// 1. Look for attribute bindings and array bindings on the current element
	if (element.attributes) {
		for (i = 0; i < element.attributes.length; i++) {
			if (element.attributes[i].nodeName === "data-each") {
				bindings.push(new ArrayBinding(element, element.attributes[i].nodeValue));
			} else {
				var attributeBindings = templating.getPlaceHolders(element.attributes[i].nodeValue)
					.map(function(placeholder) {
						var binding = new NodeBinding(element.attributes[i], placeholder, element);
						binding.on("input-change", self.updateModelProperty.bind(self));
						return binding;
					});
				bindings = bindings.concat(attributeBindings);				
			}
		}
	}
	// 2.a If the element has children, it won't have a text binding. Recurse on children
	if (element.childNodes && element.childNodes.length) {
		//recursive call for each childnode
		for (i = 0; i < element.childNodes.length; i++) {
			bindings = bindings.concat(self.getBindings(element.childNodes[i]));
		}
	} else {
		// 2.b The element doesn't have children so look for a text binding
		placeholders = templating.getPlaceHolders(element.textContent);
		var textBindings = placeholders.map(function(placeholder) {
			var binding = new NodeBinding(element, placeholder, element.parentNode);
			binding.on("input-change", self.updateModelProperty.bind(self));
			return binding;
		});
		bindings = bindings.concat(textBindings);
	}
	return bindings;
};

DroopyBinding.prototype.subscribe = function(event, property, callback) {
	var matches = _findBindings(this.bindings, property);
	//There could be many bindings for the same property, we only want to surface one event though
	if (matches && matches.length) {
		matches[0].on(event, callback);
	}
};



module.exports = DroopyBinding;
},{"./arrayBinding":5,"./nodeBinding":7,"droopy-templating":3}],7:[function(require,module,exports){
var templating = require("droopy-templating");
var Eventable = require("droopy-events");

var NodeBinding = function(node, placeholder, element) {
	Eventable.call(this);
	this.node = node;
	this.original = node.nodeValue;
	this.raw = placeholder;
	this.fullProperty = this.raw.slice(2, this.raw.length - 2);
	//if no element was passed in, it is a text binding, otherwise attribute
	this.element = element || node; 
	this.setupTwoWay();
};

NodeBinding.prototype = new Eventable();

NodeBinding.prototype.setupTwoWay = function() {
	var self = this;
	if (this.element && this.element.tagName) {
		var elementType = this.element.tagName.toLowerCase();
		// TEXT AREA
		if (elementType === "textarea") {
			this.element.addEventListener("input", this.onInputChange.bind(this));

		} else if (this.node.nodeName === "value") {
			// INPUT element
			if (elementType === "input") {
				this.element.addEventListener("input", this.onInputChange.bind(this));
			} 
			// SELECT element
			else if (elementType === "select") {
				this.element.addEventListener("change", this.onInputChange.bind(this));
				setTimeout(this.onInputChange.bind(this), 1);
			}
		}
	}

};

NodeBinding.prototype.onInputChange = function() {
	//called with bind, so 'this' is actually this
	this.trigger("input-change", this.fullProperty, this.element.value );
};

NodeBinding.prototype.update = function(model) {
	var self = this;
	self.trigger("updating");
	//skip a tick in event loop to let 'updating' be handled before update
	setTimeout(function() {
		var html = templating.renderTemplate(self.original, model);
		self.node.nodeValue = html;
		if (self.node.nodeName === "value" && self.element) {
			self.element.value = html;
		}
		self.trigger("updated");		
	},1);
};

module.exports = NodeBinding;
},{"droopy-events":2,"droopy-templating":3}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkM6XFxnaXR3aXBcXGRyb29weS1iaW5kaW5nXFxub2RlX21vZHVsZXNcXGd1bHAtYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXItcGFja1xcX3ByZWx1ZGUuanMiLCJDOi9naXR3aXAvZHJvb3B5LWJpbmRpbmcvZW50cmllcy9mYWtlX2NlN2RjYTFjLmpzIiwiQzovZ2l0d2lwL2Ryb29weS1iaW5kaW5nL25vZGVfbW9kdWxlcy9kcm9vcHktZXZlbnRzL0V2ZW50QWdncmVnYXRvci5qcyIsIkM6L2dpdHdpcC9kcm9vcHktYmluZGluZy9ub2RlX21vZHVsZXMvZHJvb3B5LXRlbXBsYXRpbmcvZHJvb3B5LXRlbXBsYXRpbmcuanMiLCJDOi9naXR3aXAvZHJvb3B5LWJpbmRpbmcvbm9kZV9tb2R1bGVzL29iamVjdC5vYnNlcnZlL2Rpc3Qvb2JqZWN0LW9ic2VydmUuanMiLCJDOi9naXR3aXAvZHJvb3B5LWJpbmRpbmcvc3JjL2FycmF5QmluZGluZy5qcyIsIkM6L2dpdHdpcC9kcm9vcHktYmluZGluZy9zcmMvZHJvb3B5QmluZGluZy5qcyIsIkM6L2dpdHdpcC9kcm9vcHktYmluZGluZy9zcmMvbm9kZUJpbmRpbmcuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbnVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG52YXIgcG9seWZpbGwgPSByZXF1aXJlKFwib2JqZWN0Lm9ic2VydmVcIik7XHJcbmdsb2JhbC5kcm9vcHlCaW5kaW5nID0ge307XHJcbmdsb2JhbC5Ecm9vcHlCaW5kaW5nID0gcmVxdWlyZShcIi4uL3NyYy9kcm9vcHlCaW5kaW5nXCIpO1xyXG5leHBvcnRzLkRyb29weUJpbmRpbmcgPSBnbG9iYWwuRHJvb3B5QmluZGluZztcbn0pLmNhbGwodGhpcyx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwidmFyIEV2ZW50QWdncmVnYXRvciA9IGZ1bmN0aW9uKCkge1xyXG5cdHRoaXMuZXZlbnRLZXlzID0ge307XHJcblx0dGhpcy5sYXN0U3Vic2NyaXB0aW9uSWQgPSAtMTtcclxufTtcclxuXHJcbkV2ZW50QWdncmVnYXRvci5wcm90b3R5cGUub24gPSBmdW5jdGlvbihrZXksIGNhbGxiYWNrKSB7XHJcblx0aWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gXCJmdW5jdGlvblwiKSB7XHJcblx0XHRpZiAoIXRoaXMuZXZlbnRLZXlzW2tleV0pIHtcclxuXHRcdFx0dGhpcy5ldmVudEtleXNba2V5XSA9IHtcclxuXHRcdFx0XHRzdWJzY3JpcHRpb25zOiB7fVxyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cdFx0dmFyIHRva2VuID0gKCsrdGhpcy5sYXN0U3Vic2NyaXB0aW9uSWQpLnRvU3RyaW5nKCk7XHJcblx0XHR0aGlzLmV2ZW50S2V5c1trZXldLnN1YnNjcmlwdGlvbnNbdG9rZW5dID0gY2FsbGJhY2s7XHJcblx0XHRyZXR1cm4gdG9rZW47XHJcblx0fSBlbHNlIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcbn07XHJcblxyXG5FdmVudEFnZ3JlZ2F0b3IucHJvdG90eXBlLm9mZiA9IGZ1bmN0aW9uKGtleSwgdG9rZW5PckNhbGxiYWNrKSB7XHJcblx0aWYgKHR5cGVvZiB0b2tlbk9yQ2FsbGJhY2sgPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdC8vQ2FsbGJhY2sgcmVmZXJlbmNlIHdhcyBwYXNzZWQgaW4gc28gZmluZCB0aGUgc3Vic2NyaXB0aW9uIHdpdGggdGhlIG1hdGNoaW5nIGZ1bmN0aW9uXHJcblx0XHRpZiAodGhpcy5ldmVudEtleXNba2V5XSkge1xyXG5cdFx0XHR2YXIgZXZlbnRTdWJzY3JpcHRpb25zID0gdGhpcy5ldmVudEtleXNba2V5XS5zdWJzY3JpcHRpb25zO1xyXG5cdFx0XHR2YXIgbWF0Y2hpbmdJZCA9IG51bGw7XHJcblx0XHRcdC8vZm9yZWFjaCBzdWJzY3JpcHRpb24gc2VlIGlmIHRoZSBmdW5jdGlvbnMgbWF0Y2ggYW5kIHNhdmUgdGhlIGtleSBpZiB5ZXNcclxuXHRcdFx0Zm9yICh2YXIgc3Vic2NyaXB0aW9uSWQgaW4gZXZlbnRTdWJzY3JpcHRpb25zKSB7XHJcblx0XHRcdFx0aWYgKGV2ZW50U3Vic2NyaXB0aW9ucy5oYXNPd25Qcm9wZXJ0eShzdWJzY3JpcHRpb25JZCkpIHtcclxuXHRcdFx0XHRcdGlmIChldmVudFN1YnNjcmlwdGlvbnNbc3Vic2NyaXB0aW9uSWRdID09PSB0b2tlbk9yQ2FsbGJhY2spIHtcclxuXHRcdFx0XHRcdFx0bWF0Y2hpbmdJZCA9IHN1YnNjcmlwdGlvbklkO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAobWF0Y2hpbmdJZCAhPT0gbnVsbCkge1xyXG5cdFx0XHRcdGRlbGV0ZSBldmVudFN1YnNjcmlwdGlvbnNbbWF0Y2hpbmdJZF07XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9IGVsc2Uge1xyXG5cdFx0Ly9Ub2tlbiB3YXMgcGFzc2VkIGluXHJcblx0XHRpZiAodGhpcy5ldmVudEtleXNba2V5XSAmJiB0aGlzLmV2ZW50S2V5c1trZXldLnN1YnNjcmlwdGlvbnNbdG9rZW5PckNhbGxiYWNrXSkge1xyXG5cdFx0XHRkZWxldGUgdGhpcy5ldmVudEtleXNba2V5XS5zdWJzY3JpcHRpb25zW3Rva2VuT3JDYWxsYmFja107XHJcblx0XHR9XHJcblx0fVxyXG59O1xyXG5cclxuRXZlbnRBZ2dyZWdhdG9yLnByb3RvdHlwZS50cmlnZ2VyID0gZnVuY3Rpb24oa2V5KSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cdGlmIChzZWxmLmV2ZW50S2V5c1trZXldKSB7XHJcblx0XHR2YXIgdmFsdWVzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcclxuXHRcdC8vSWYgcGFzc2luZyBsZXNzIHRoYW4gdmFsdWVzIHBhc3MgdGhlbSBpbmRpdmlkdWFsbHlcclxuXHRcdHZhciBhMSA9IHZhbHVlc1swXSxcclxuXHRcdFx0YTIgPSB2YWx1ZXNbMV0sXHJcblx0XHRcdGEzID0gdmFsdWVzWzJdO1xyXG5cdFx0Ly9FbHNlIGlmIHBhc3NpbmcgbW9yZSB0aGFuIDMgdmFsdWVzIGdyb3VwIGFzIGFuIGFyZ3MgYXJyYXlcclxuXHRcdGlmICh2YWx1ZXMubGVuZ3RoID4gMykge1xyXG5cdFx0XHRhMSA9IHZhbHVlcztcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgc3Vic2NyaXB0aW9ucyA9IHNlbGYuZXZlbnRLZXlzW2tleV0uc3Vic2NyaXB0aW9ucztcclxuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcblx0XHRcdGZvciAodmFyIHRva2VuIGluIHN1YnNjcmlwdGlvbnMpIHtcclxuXHRcdFx0XHRpZiAoc3Vic2NyaXB0aW9ucy5oYXNPd25Qcm9wZXJ0eSh0b2tlbikpIHtcclxuXHRcdFx0XHRcdHN1YnNjcmlwdGlvbnNbdG9rZW5dKGExLCBhMiwgYTMpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSwgMCk7XHJcblx0fVxyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEFnZ3JlZ2F0b3I7IiwidmFyIHRlbXBsYXRpbmcgPSB7XHJcblxyXG5cdFBsYWNlaG9sZGVyOiBmdW5jdGlvbihyYXcpIHtcclxuXHRcdHRoaXMucmF3ID0gcmF3O1xyXG5cdFx0dGhpcy5mdWxsUHJvcGVydHkgPSByYXcuc2xpY2UoMiwgcmF3Lmxlbmd0aCAtIDIpO1xyXG5cdH0sXHJcblxyXG5cdGdldFBsYWNlSG9sZGVyczogZnVuY3Rpb24odGVtcGxhdGUsIHJlZ2V4cCkge1xyXG5cdFx0dmFyIHJlZ0V4cFBhdHRlcm4gPSByZWdleHAgfHwgL1xce1xce1teXFx9XStcXH1cXH0/L2c7XHJcblx0XHR2YXIgbWF0Y2hlcyA9IHRlbXBsYXRlLm1hdGNoKHJlZ0V4cFBhdHRlcm4pO1xyXG5cdFx0cmV0dXJuIG1hdGNoZXMgfHwgW107XHJcblx0fSxcclxuXHJcblx0Z2V0T2JqZWN0VmFsdWU6IGZ1bmN0aW9uKG9iaiwgZnVsbFByb3BlcnR5KSB7XHJcblx0XHR2YXIgdmFsdWUgPSBvYmosXHJcblx0XHRcdHByb3BlcnR5Q2hhaW4gPSBmdWxsUHJvcGVydHkuc3BsaXQoJy4nKTtcclxuXHJcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHByb3BlcnR5Q2hhaW4ubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0dmFyIHByb3BlcnR5ID0gcHJvcGVydHlDaGFpbltpXTtcclxuXHRcdFx0dmFsdWUgPSB2YWx1ZVtwcm9wZXJ0eV0gIT0gbnVsbCA/IHZhbHVlW3Byb3BlcnR5XSA6IFwiTm90IEZvdW5kOiBcIiArIGZ1bGxQcm9wZXJ0eTtcclxuXHRcdH1cclxuXHJcblx0XHRpZihmdWxsUHJvcGVydHkgPT09IFwiX1wiKSB7XHJcblx0XHRcdHZhbHVlID0gb2JqO1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHRpZiAoKHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIikgJiYgdmFsdWUuaW5kZXhPZihcIi9EYXRlKFwiKSAhPT0gLTEpIHtcclxuXHRcdFx0dmFyIGRhdGVWYWx1ZSA9IFVUQ0pzb25Ub0RhdGUodmFsdWUpO1xyXG5cdFx0XHR2YWx1ZSA9IGRhdGVWYWx1ZS50b0xvY2FsZURhdGVTdHJpbmcoKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdmFsdWU7XHJcblx0fSxcclxuXHJcblx0cG9wdWxhdGVUZW1wbGF0ZTogZnVuY3Rpb24odGVtcGxhdGUsIGl0ZW0sIHJlZ2V4cCkge1xyXG5cdFx0dmFyIHBsYWNlaG9sZGVycyA9IHRoaXMuZ2V0UGxhY2VIb2xkZXJzKHRlbXBsYXRlLCByZWdleHApIHx8IFtdLFxyXG5cdFx0XHRpdGVtSHRtbCA9IHRlbXBsYXRlO1xyXG5cclxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgcGxhY2Vob2xkZXJzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdHZhciBwbGFjZWhvbGRlciA9IG5ldyB0aGlzLlBsYWNlaG9sZGVyKHBsYWNlaG9sZGVyc1tpXSk7XHJcblx0XHRcdHBsYWNlaG9sZGVyLnZhbCA9IHRoaXMuZ2V0T2JqZWN0VmFsdWUoaXRlbSwgcGxhY2Vob2xkZXIuZnVsbFByb3BlcnR5KTtcclxuXHRcdFx0dmFyIHBhdHRlcm4gPSBwbGFjZWhvbGRlci5yYXcucmVwbGFjZShcIltcIiwgXCJcXFxcW1wiKS5yZXBsYWNlKFwiXVwiLCBcIlxcXFxdXCIpO1xyXG5cdFx0XHR2YXIgbW9kaWZpZXIgPSBcImdcIjtcclxuXHRcdFx0aXRlbUh0bWwgPSBpdGVtSHRtbC5yZXBsYWNlKG5ldyBSZWdFeHAocGF0dGVybiwgbW9kaWZpZXIpLCBwbGFjZWhvbGRlci52YWwpO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIGl0ZW1IdG1sO1xyXG5cdH1cclxufTtcclxuXHJcbnRlbXBsYXRpbmcuRWFjaCA9IHtcclxuXHJcblx0cmVnRXhwOiAvXFx7XFxbW15cXF1dK1xcXVxcfT8vZyxcclxuXHJcblx0cG9wdWxhdGVFYWNoVGVtcGxhdGVzOiBmdW5jdGlvbihpdGVtSHRtbCwgaXRlbSkge1xyXG5cdFx0dmFyICRpdGVtSHRtbCA9ICQoaXRlbUh0bWwpLFxyXG5cdFx0XHRlYWNoVGVtcGxhdGVzID0gJGl0ZW1IdG1sLmZpbmQoXCJbZGF0YS1lYWNoXVwiKTtcclxuXHJcblx0XHRlYWNoVGVtcGxhdGVzLmVhY2goZnVuY3Rpb24oKSB7XHJcblx0XHRcdHZhciBhcnJheUh0bWwgPSBcIlwiLFxyXG5cdFx0XHRcdGl0ZW1UZW1wbGF0ZSA9ICQodGhpcykuaHRtbCgpLFxyXG5cdFx0XHRcdGFycmF5UHJvcCA9ICQodGhpcykuZGF0YShcImVhY2hcIiksXHJcblx0XHRcdFx0YXJyYXkgPSBzcC50ZW1wbGF0aW5nLmdldE9iamVjdFZhbHVlKGl0ZW0sIGFycmF5UHJvcCk7XHJcblxyXG5cdFx0XHRpZiAoYXJyYXkgIT0gbnVsbCAmJiAkLmlzQXJyYXkoYXJyYXkpKSB7XHJcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdFx0YXJyYXlIdG1sICs9IHRlbXBsYXRpbmcucG9wdWxhdGVUZW1wbGF0ZShpdGVtVGVtcGxhdGUsIGFycmF5W2ldLCB0ZW1wbGF0aW5nLkVhY2gucmVnRXhwKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdCRpdGVtSHRtbC5maW5kKCQodGhpcykpLmh0bWwoYXJyYXlIdG1sKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHZhciB0ZW1wID0gJGl0ZW1IdG1sLmNsb25lKCkud3JhcChcIjxkaXY+XCIpO1xyXG5cdFx0cmV0dXJuIHRlbXAucGFyZW50KCkuaHRtbCgpO1xyXG5cdH1cclxufTtcclxuXHJcbnRlbXBsYXRpbmcucmVuZGVyVGVtcGxhdGUgPSBmdW5jdGlvbih0ZW1wbGF0ZSwgaXRlbSwgcmVuZGVyRWFjaFRlbXBsYXRlKSB7XHJcblx0dmFyIGl0ZW1IdG1sID0gdGVtcGxhdGluZy5wb3B1bGF0ZVRlbXBsYXRlKHRlbXBsYXRlLCBpdGVtKTtcclxuXHRpZiAocmVuZGVyRWFjaFRlbXBsYXRlKSB7XHJcblx0XHRpdGVtSHRtbCA9IHRlbXBsYXRpbmcuRWFjaC5wb3B1bGF0ZUVhY2hUZW1wbGF0ZXMoaXRlbUh0bWwsIGl0ZW0pO1xyXG5cdH1cclxuXHRyZXR1cm4gaXRlbUh0bWw7XHJcbn07XHJcblxyXG52YXIgVVRDSnNvblRvRGF0ZSA9IGZ1bmN0aW9uKGpzb25EYXRlKSB7XHJcblx0dmFyIHV0Y1N0ciA9IGpzb25EYXRlLnN1YnN0cmluZyhqc29uRGF0ZS5pbmRleE9mKFwiKFwiKSArIDEpO1xyXG5cdHV0Y1N0ciA9IHV0Y1N0ci5zdWJzdHJpbmcoMCwgdXRjU3RyLmluZGV4T2YoXCIpXCIpKTtcclxuXHJcblx0dmFyIHJldHVybkRhdGUgPSBuZXcgRGF0ZShwYXJzZUludCh1dGNTdHIsIDEwKSk7XHJcblx0dmFyIGhvdXJPZmZzZXQgPSByZXR1cm5EYXRlLmdldFRpbWV6b25lT2Zmc2V0KCkgLyA2MDtcclxuXHRyZXR1cm5EYXRlLnNldEhvdXJzKHJldHVybkRhdGUuZ2V0SG91cnMoKSArIGhvdXJPZmZzZXQpO1xyXG5cclxuXHRyZXR1cm4gcmV0dXJuRGF0ZTtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gdGVtcGxhdGluZzsiLCIvKiFcclxuICogT2JqZWN0Lm9ic2VydmUgcG9seWZpbGwgLSB2MC4yLjNcclxuICogYnkgTWFzc2ltbyBBcnRpenp1IChNYXhBcnQyNTAxKVxyXG4gKiBcclxuICogaHR0cHM6Ly9naXRodWIuY29tL01heEFydDI1MDEvb2JqZWN0LW9ic2VydmVcclxuICogXHJcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZVxyXG4gKiBTZWUgTElDRU5TRSBmb3IgZGV0YWlsc1xyXG4gKi9cclxuXHJcbi8vIFNvbWUgdHlwZSBkZWZpbml0aW9uc1xyXG4vKipcclxuICogVGhpcyByZXByZXNlbnRzIHRoZSBkYXRhIHJlbGF0aXZlIHRvIGFuIG9ic2VydmVkIG9iamVjdFxyXG4gKiBAdHlwZWRlZiAge09iamVjdH0gICAgICAgICAgICAgICAgICAgICBPYmplY3REYXRhXHJcbiAqIEBwcm9wZXJ0eSB7TWFwPEhhbmRsZXIsIEhhbmRsZXJEYXRhPn0gIGhhbmRsZXJzXHJcbiAqIEBwcm9wZXJ0eSB7U3RyaW5nW119ICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXNcclxuICogQHByb3BlcnR5IHsqW119ICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzXHJcbiAqIEBwcm9wZXJ0eSB7RGVzY3JpcHRvcltdfSAgICAgICAgICAgICAgIGRlc2NyaXB0b3JzXHJcbiAqIEBwcm9wZXJ0eSB7Tm90aWZpZXJ9ICAgICAgICAgICAgICAgICAgIG5vdGlmaWVyXHJcbiAqIEBwcm9wZXJ0eSB7Qm9vbGVhbn0gICAgICAgICAgICAgICAgICAgIGZyb3plblxyXG4gKiBAcHJvcGVydHkge0Jvb2xlYW59ICAgICAgICAgICAgICAgICAgICBleHRlbnNpYmxlXHJcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0fSAgICAgICAgICAgICAgICAgICAgIHByb3RvXHJcbiAqL1xyXG4vKipcclxuICogRnVuY3Rpb24gZGVmaW5pdGlvbiBvZiBhIGhhbmRsZXJcclxuICogQGNhbGxiYWNrIEhhbmRsZXJcclxuICogQHBhcmFtIHtDaGFuZ2VSZWNvcmRbXX0gICAgICAgICAgICAgICAgY2hhbmdlc1xyXG4qL1xyXG4vKipcclxuICogVGhpcyByZXByZXNlbnRzIHRoZSBkYXRhIHJlbGF0aXZlIHRvIGFuIG9ic2VydmVkIG9iamVjdCBhbmQgb25lIG9mIGl0c1xyXG4gKiBoYW5kbGVyc1xyXG4gKiBAdHlwZWRlZiAge09iamVjdH0gICAgICAgICAgICAgICAgICAgICBIYW5kbGVyRGF0YVxyXG4gKiBAcHJvcGVydHkge01hcDxPYmplY3QsIE9ic2VydmVkRGF0YT59ICBvYnNlcnZlZFxyXG4gKiBAcHJvcGVydHkge0NoYW5nZVJlY29yZFtdfSAgICAgICAgICAgICBjaGFuZ2VSZWNvcmRzXHJcbiAqL1xyXG4vKipcclxuICogQHR5cGVkZWYgIHtPYmplY3R9ICAgICAgICAgICAgICAgICAgICAgT2JzZXJ2ZWREYXRhXHJcbiAqIEBwcm9wZXJ0eSB7U3RyaW5nW119ICAgICAgICAgICAgICAgICAgIGFjY2VwdExpc3RcclxuICogQHByb3BlcnR5IHtPYmplY3REYXRhfSAgICAgICAgICAgICAgICAgZGF0YVxyXG4qL1xyXG4vKipcclxuICogVHlwZSBkZWZpbml0aW9uIGZvciBhIGNoYW5nZS4gQW55IG90aGVyIHByb3BlcnR5IGNhbiBiZSBhZGRlZCB1c2luZ1xyXG4gKiB0aGUgbm90aWZ5KCkgb3IgcGVyZm9ybUNoYW5nZSgpIG1ldGhvZHMgb2YgdGhlIG5vdGlmaWVyLlxyXG4gKiBAdHlwZWRlZiAge09iamVjdH0gICAgICAgICAgICAgICAgICAgICBDaGFuZ2VSZWNvcmRcclxuICogQHByb3BlcnR5IHtTdHJpbmd9ICAgICAgICAgICAgICAgICAgICAgdHlwZVxyXG4gKiBAcHJvcGVydHkge09iamVjdH0gICAgICAgICAgICAgICAgICAgICBvYmplY3RcclxuICogQHByb3BlcnR5IHtTdHJpbmd9ICAgICAgICAgICAgICAgICAgICAgW25hbWVdXHJcbiAqIEBwcm9wZXJ0eSB7Kn0gICAgICAgICAgICAgICAgICAgICAgICAgIFtvbGRWYWx1ZV1cclxuICogQHByb3BlcnR5IHtOdW1iZXJ9ICAgICAgICAgICAgICAgICAgICAgW2luZGV4XVxyXG4gKi9cclxuLyoqXHJcbiAqIFR5cGUgZGVmaW5pdGlvbiBmb3IgYSBub3RpZmllciAod2hhdCBPYmplY3QuZ2V0Tm90aWZpZXIgcmV0dXJucylcclxuICogQHR5cGVkZWYgIHtPYmplY3R9ICAgICAgICAgICAgICAgICAgICAgTm90aWZpZXJcclxuICogQHByb3BlcnR5IHtGdW5jdGlvbn0gICAgICAgICAgICAgICAgICAgbm90aWZ5XHJcbiAqIEBwcm9wZXJ0eSB7RnVuY3Rpb259ICAgICAgICAgICAgICAgICAgIHBlcmZvcm1DaGFuZ2VcclxuICovXHJcbi8qKlxyXG4gKiBGdW5jdGlvbiBjYWxsZWQgd2l0aCBOb3RpZmllci5wZXJmb3JtQ2hhbmdlLiBJdCBtYXkgb3B0aW9uYWxseSByZXR1cm4gYVxyXG4gKiBDaGFuZ2VSZWNvcmQgdGhhdCBnZXRzIGF1dG9tYXRpY2FsbHkgbm90aWZpZWQsIGJ1dCBgdHlwZWAgYW5kIGBvYmplY3RgXHJcbiAqIHByb3BlcnRpZXMgYXJlIG92ZXJyaWRkZW4uXHJcbiAqIEBjYWxsYmFjayBQZXJmb3JtZXJcclxuICogQHJldHVybnMge0NoYW5nZVJlY29yZHx1bmRlZmluZWR9XHJcbiAqL1xyXG5cclxuT2JqZWN0Lm9ic2VydmUgfHwgKGZ1bmN0aW9uKE8sIEEsIHJvb3QpIHtcclxuICAgIFwidXNlIHN0cmljdFwiO1xyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBSZWxhdGVzIG9ic2VydmVkIG9iamVjdHMgYW5kIHRoZWlyIGRhdGFcclxuICAgICAgICAgKiBAdHlwZSB7TWFwPE9iamVjdCwgT2JqZWN0RGF0YX1cclxuICAgICAgICAgKi9cclxuICAgIHZhciBvYnNlcnZlZCxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBMaXN0IG9mIGhhbmRsZXJzIGFuZCB0aGVpciBkYXRhXHJcbiAgICAgICAgICogQHR5cGUge01hcDxIYW5kbGVyLCBNYXA8T2JqZWN0LCBIYW5kbGVyRGF0YT4+fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGhhbmRsZXJzLFxyXG5cclxuICAgICAgICBkZWZhdWx0QWNjZXB0TGlzdCA9IFsgXCJhZGRcIiwgXCJ1cGRhdGVcIiwgXCJkZWxldGVcIiwgXCJyZWNvbmZpZ3VyZVwiLCBcInNldFByb3RvdHlwZVwiLCBcInByZXZlbnRFeHRlbnNpb25zXCIgXTtcclxuXHJcbiAgICAvLyBGdW5jdGlvbnMgZm9yIGludGVybmFsIHVzYWdlXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIENoZWNrcyBpZiB0aGUgYXJndW1lbnQgaXMgYW4gQXJyYXkgb2JqZWN0LiBQb2x5ZmlsbHMgQXJyYXkuaXNBcnJheS5cclxuICAgICAgICAgKiBAZnVuY3Rpb24gaXNBcnJheVxyXG4gICAgICAgICAqIEBwYXJhbSB7Pyp9IG9iamVjdFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgdmFyIGlzQXJyYXkgPSBBLmlzQXJyYXkgfHwgKGZ1bmN0aW9uKHRvU3RyaW5nKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAob2JqZWN0KSB7IHJldHVybiB0b1N0cmluZy5jYWxsKG9iamVjdCkgPT09IFwiW29iamVjdCBBcnJheV1cIjsgfTtcclxuICAgICAgICB9KShPLnByb3RvdHlwZS50b1N0cmluZyksXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFJldHVybnMgdGhlIGluZGV4IG9mIGFuIGl0ZW0gaW4gYSBjb2xsZWN0aW9uLCBvciAtMSBpZiBub3QgZm91bmQuXHJcbiAgICAgICAgICogVXNlcyB0aGUgZ2VuZXJpYyBBcnJheS5pbmRleE9mIG9yIEFycmF5LnByb3RvdHlwZS5pbmRleE9mIGlmIGF2YWlsYWJsZS5cclxuICAgICAgICAgKiBAZnVuY3Rpb24gaW5BcnJheVxyXG4gICAgICAgICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5XHJcbiAgICAgICAgICogQHBhcmFtIHsqfSBwaXZvdCAgICAgICAgICAgSXRlbSB0byBsb29rIGZvclxyXG4gICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBbc3RhcnQ9MF0gIEluZGV4IHRvIHN0YXJ0IGZyb21cclxuICAgICAgICAgKiBAcmV0dXJucyB7TnVtYmVyfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGluQXJyYXkgPSBBLnByb3RvdHlwZS5pbmRleE9mID8gQS5pbmRleE9mIHx8IGZ1bmN0aW9uKGFycmF5LCBwaXZvdCwgc3RhcnQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIEEucHJvdG90eXBlLmluZGV4T2YuY2FsbChhcnJheSwgcGl2b3QsIHN0YXJ0KTtcclxuICAgICAgICB9IDogZnVuY3Rpb24oYXJyYXksIHBpdm90LCBzdGFydCkge1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gc3RhcnQgfHwgMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKVxyXG4gICAgICAgICAgICAgICAgaWYgKGFycmF5W2ldID09PSBwaXZvdClcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaTtcclxuICAgICAgICAgICAgcmV0dXJuIC0xO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgTWFwLCBvciBhIE1hcC1saWtlIG9iamVjdCBpcyBNYXAgaXMgbm90XHJcbiAgICAgICAgICogc3VwcG9ydGVkIG9yIGRvZXNuJ3Qgc3VwcG9ydCBmb3JFYWNoKClcclxuICAgICAgICAgKiBAZnVuY3Rpb24gY3JlYXRlTWFwXHJcbiAgICAgICAgICogQHJldHVybnMge01hcH1cclxuICAgICAgICAgKi9cclxuICAgICAgICBjcmVhdGVNYXAgPSB0eXBlb2Ygcm9vdC5NYXAgPT09IFwidW5kZWZpbmVkXCIgfHwgIU1hcC5wcm90b3R5cGUuZm9yRWFjaCA/IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAvLyBMaWdodHdlaWdodCBzaGltIG9mIE1hcC4gTGFja3MgY2xlYXIoKSwgZW50cmllcygpLCBrZXlzKCkgYW5kXHJcbiAgICAgICAgICAgIC8vIHZhbHVlcygpICh0aGUgbGFzdCAzIG5vdCBzdXBwb3J0ZWQgYnkgSUUxMSwgc28gY2FuJ3QgdXNlIHRoZW0pLFxyXG4gICAgICAgICAgICAvLyBpdCBkb2Vzbid0IGhhbmRsZSB0aGUgY29uc3RydWN0b3IncyBhcmd1bWVudCAobGlrZSBJRTExKSBhbmQgb2ZcclxuICAgICAgICAgICAgLy8gY291cnNlIGl0IGRvZXNuJ3Qgc3VwcG9ydCBmb3IuLi5vZi5cclxuICAgICAgICAgICAgLy8gQ2hyb21lIDMxLTM1IGFuZCBGaXJlZm94IDEzLTI0IGhhdmUgYSBiYXNpYyBzdXBwb3J0IG9mIE1hcCwgYnV0XHJcbiAgICAgICAgICAgIC8vIHRoZXkgbGFjayBmb3JFYWNoKCksIHNvIHRoZWlyIG5hdGl2ZSBpbXBsZW1lbnRhdGlvbiBpcyBiYWQgZm9yXHJcbiAgICAgICAgICAgIC8vIHRoaXMgcG9seWZpbGwuIChDaHJvbWUgMzYrIHN1cHBvcnRzIE9iamVjdC5vYnNlcnZlLilcclxuICAgICAgICAgICAgdmFyIGtleXMgPSBbXSwgdmFsdWVzID0gW107XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc2l6ZTogMCxcclxuICAgICAgICAgICAgICAgIGhhczogZnVuY3Rpb24oa2V5KSB7IHJldHVybiBpbkFycmF5KGtleXMsIGtleSkgPiAtMTsgfSxcclxuICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24oa2V5KSB7IHJldHVybiB2YWx1ZXNbaW5BcnJheShrZXlzLCBrZXkpXTsgfSxcclxuICAgICAgICAgICAgICAgIHNldDogZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBpID0gaW5BcnJheShrZXlzLCBrZXkpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChpID09PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBrZXlzLnB1c2goa2V5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzLnB1c2godmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNpemUrKztcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgdmFsdWVzW2ldID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgXCJkZWxldGVcIjogZnVuY3Rpb24oa2V5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGkgPSBpbkFycmF5KGtleXMsIGtleSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGkgPiAtMSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBrZXlzLnNwbGljZShpLCAxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzLnNwbGljZShpLCAxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zaXplLS07XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGZvckVhY2g6IGZ1bmN0aW9uKGNhbGxiYWNrLyosIHRoaXNPYmoqLykge1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKylcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2suY2FsbChhcmd1bWVudHNbMV0sIHZhbHVlc1tpXSwga2V5c1tpXSwgdGhpcyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSA6IGZ1bmN0aW9uKCkgeyByZXR1cm4gbmV3IE1hcCgpOyB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBTaW1wbGUgc2hpbSBmb3IgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMgd2hlbiBpcyBub3QgYXZhaWxhYmxlXHJcbiAgICAgICAgICogTWlzc2VzIGNoZWNrcyBvbiBvYmplY3QsIGRvbid0IHVzZSBhcyBhIHJlcGxhY2VtZW50IG9mIE9iamVjdC5rZXlzL2dldE93blByb3BlcnR5TmFtZXNcclxuICAgICAgICAgKiBAZnVuY3Rpb24gZ2V0UHJvcHNcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XHJcbiAgICAgICAgICogQHJldHVybnMge1N0cmluZ1tdfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldFByb3BzID0gTy5nZXRPd25Qcm9wZXJ0eU5hbWVzID8gKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB2YXIgZnVuYyA9IE8uZ2V0T3duUHJvcGVydHlOYW1lcztcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGFyZ3VtZW50cy5jYWxsZWU7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgICAgIC8vIFN0cmljdCBtb2RlIGlzIHN1cHBvcnRlZFxyXG5cclxuICAgICAgICAgICAgICAgIC8vIEluIHN0cmljdCBtb2RlLCB3ZSBjYW4ndCBhY2Nlc3MgdG8gXCJhcmd1bWVudHNcIiwgXCJjYWxsZXJcIiBhbmRcclxuICAgICAgICAgICAgICAgIC8vIFwiY2FsbGVlXCIgcHJvcGVydGllcyBvZiBmdW5jdGlvbnMuIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzXHJcbiAgICAgICAgICAgICAgICAvLyByZXR1cm5zIFsgXCJwcm90b3R5cGVcIiwgXCJsZW5ndGhcIiwgXCJuYW1lXCIgXSBpbiBGaXJlZm94OyBpdCByZXR1cm5zXHJcbiAgICAgICAgICAgICAgICAvLyBcImNhbGxlclwiIGFuZCBcImFyZ3VtZW50c1wiIHRvbyBpbiBDaHJvbWUgYW5kIGluIEludGVybmV0XHJcbiAgICAgICAgICAgICAgICAvLyBFeHBsb3Jlciwgc28gdGhvc2UgdmFsdWVzIG11c3QgYmUgZmlsdGVyZWQuXHJcbiAgICAgICAgICAgICAgICB2YXIgYXZvaWQgPSAoZnVuYyhpbkFycmF5KS5qb2luKFwiIFwiKSArIFwiIFwiKS5yZXBsYWNlKC9wcm90b3R5cGUgfGxlbmd0aCB8bmFtZSAvZywgXCJcIikuc2xpY2UoMCwgLTEpLnNwbGl0KFwiIFwiKTtcclxuICAgICAgICAgICAgICAgIGlmIChhdm9pZC5sZW5ndGgpIGZ1bmMgPSBmdW5jdGlvbihvYmplY3QpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgcHJvcHMgPSBPLmdldE93blByb3BlcnR5TmFtZXMob2JqZWN0KTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG9iamVjdCA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgajsgaSA8IGF2b2lkLmxlbmd0aDspXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoKGogPSBpbkFycmF5KHByb3BzLCBhdm9pZFtpKytdKSkgPiAtMSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wcy5zcGxpY2UoaiwgMSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwcm9wcztcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGZ1bmM7XHJcbiAgICAgICAgfSkoKSA6IGZ1bmN0aW9uKG9iamVjdCkge1xyXG4gICAgICAgICAgICAvLyBQb29yLW1vdXRoIHZlcnNpb24gd2l0aCBmb3IuLi5pbiAoSUU4LSlcclxuICAgICAgICAgICAgdmFyIHByb3BzID0gW10sIHByb3AsIGhvcDtcclxuICAgICAgICAgICAgaWYgKFwiaGFzT3duUHJvcGVydHlcIiBpbiBvYmplY3QpIHtcclxuICAgICAgICAgICAgICAgIGZvciAocHJvcCBpbiBvYmplY3QpXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9iamVjdC5oYXNPd25Qcm9wZXJ0eShwcm9wKSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcHMucHVzaChwcm9wKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGhvcCA9IE8uaGFzT3duUHJvcGVydHk7XHJcbiAgICAgICAgICAgICAgICBmb3IgKHByb3AgaW4gb2JqZWN0KVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChob3AuY2FsbChvYmplY3QsIHByb3ApKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wcy5wdXNoKHByb3ApO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBJbnNlcnRpbmcgYSBjb21tb24gbm9uLWVudW1lcmFibGUgcHJvcGVydHkgb2YgYXJyYXlzXHJcbiAgICAgICAgICAgIGlmIChpc0FycmF5KG9iamVjdCkpXHJcbiAgICAgICAgICAgICAgICBwcm9wcy5wdXNoKFwibGVuZ3RoXCIpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHByb3BzO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFJldHVybiB0aGUgcHJvdG90eXBlIG9mIHRoZSBvYmplY3QuLi4gaWYgZGVmaW5lZC5cclxuICAgICAgICAgKiBAZnVuY3Rpb24gZ2V0UHJvdG90eXBlXHJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0UHJvdG90eXBlID0gTy5nZXRQcm90b3R5cGVPZixcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogUmV0dXJuIHRoZSBkZXNjcmlwdG9yIG9mIHRoZSBvYmplY3QuLi4gaWYgZGVmaW5lZC5cclxuICAgICAgICAgKiBJRTggc3VwcG9ydHMgYSAodXNlbGVzcykgT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvciBmb3IgRE9NXHJcbiAgICAgICAgICogbm9kZXMgb25seSwgc28gZGVmaW5lUHJvcGVydGllcyBpcyBjaGVja2VkIGluc3RlYWQuXHJcbiAgICAgICAgICogQGZ1bmN0aW9uIGdldERlc2NyaXB0b3JcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XHJcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5XHJcbiAgICAgICAgICogQHJldHVybnMge0Rlc2NyaXB0b3J9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0RGVzY3JpcHRvciA9IE8uZGVmaW5lUHJvcGVydGllcyAmJiBPLmdldE93blByb3BlcnR5RGVzY3JpcHRvcixcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogU2V0cyB1cCB0aGUgbmV4dCBjaGVjayBhbmQgZGVsaXZlcmluZyBpdGVyYXRpb24sIHVzaW5nXHJcbiAgICAgICAgICogcmVxdWVzdEFuaW1hdGlvbkZyYW1lIG9yIGEgKGNsb3NlKSBwb2x5ZmlsbC5cclxuICAgICAgICAgKiBAZnVuY3Rpb24gbmV4dEZyYW1lXHJcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbn0gZnVuY1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtudW1iZXJ9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbmV4dEZyYW1lID0gcm9vdC5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHwgcm9vdC53ZWJraXRSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHwgKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB2YXIgaW5pdGlhbCA9ICtuZXcgRGF0ZSxcclxuICAgICAgICAgICAgICAgIGxhc3QgPSBpbml0aWFsO1xyXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZnVuYykge1xyXG4gICAgICAgICAgICAgICAgdmFyIG5vdyA9ICtuZXcgRGF0ZTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZ1bmMoKGxhc3QgPSArbmV3IERhdGUpIC0gaW5pdGlhbCk7XHJcbiAgICAgICAgICAgICAgICB9LCAxNyk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSkoKSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogU2V0cyB1cCB0aGUgb2JzZXJ2YXRpb24gb2YgYW4gb2JqZWN0XHJcbiAgICAgICAgICogQGZ1bmN0aW9uIGRvT2JzZXJ2ZVxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAgICAgKiBAcGFyYW0ge0hhbmRsZXJ9IGhhbmRsZXJcclxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ1tdfSBbYWNjZXB0TGlzdF1cclxuICAgICAgICAgKi9cclxuICAgICAgICBkb09ic2VydmUgPSBmdW5jdGlvbihvYmplY3QsIGhhbmRsZXIsIGFjY2VwdExpc3QpIHtcclxuXHJcbiAgICAgICAgICAgIHZhciBkYXRhID0gb2JzZXJ2ZWQuZ2V0KG9iamVjdCk7XHJcblxyXG4gICAgICAgICAgICBpZiAoZGF0YSlcclxuICAgICAgICAgICAgICAgIHNldEhhbmRsZXIob2JqZWN0LCBkYXRhLCBoYW5kbGVyLCBhY2NlcHRMaXN0KTtcclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBkYXRhID0gY3JlYXRlT2JqZWN0RGF0YShvYmplY3QpO1xyXG4gICAgICAgICAgICAgICAgc2V0SGFuZGxlcihvYmplY3QsIGRhdGEsIGhhbmRsZXIsIGFjY2VwdExpc3QpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAob2JzZXJ2ZWQuc2l6ZSA9PT0gMSlcclxuICAgICAgICAgICAgICAgICAgICAvLyBMZXQgdGhlIG9ic2VydmF0aW9uIGJlZ2luIVxyXG4gICAgICAgICAgICAgICAgICAgIG5leHRGcmFtZShydW5HbG9iYWxMb29wKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIENyZWF0ZXMgdGhlIGluaXRpYWwgZGF0YSBmb3IgYW4gb2JzZXJ2ZWQgb2JqZWN0XHJcbiAgICAgICAgICogQGZ1bmN0aW9uIGNyZWF0ZU9iamVjdERhdGFcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgY3JlYXRlT2JqZWN0RGF0YSA9IGZ1bmN0aW9uKG9iamVjdCwgZGF0YSkge1xyXG4gICAgICAgICAgICB2YXIgcHJvcHMgPSBnZXRQcm9wcyhvYmplY3QpLFxyXG4gICAgICAgICAgICAgICAgdmFsdWVzID0gW10sIGRlc2NzLCBpID0gMCxcclxuICAgICAgICAgICAgICAgIGRhdGEgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaGFuZGxlcnM6IGNyZWF0ZU1hcCgpLFxyXG4gICAgICAgICAgICAgICAgICAgIGZyb3plbjogTy5pc0Zyb3plbiA/IE8uaXNGcm96ZW4ob2JqZWN0KSA6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgIGV4dGVuc2libGU6IE8uaXNFeHRlbnNpYmxlID8gTy5pc0V4dGVuc2libGUob2JqZWN0KSA6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvdG86IGdldFByb3RvdHlwZSAmJiBnZXRQcm90b3R5cGUob2JqZWN0KSxcclxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiBwcm9wcyxcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZXM6IHZhbHVlcyxcclxuICAgICAgICAgICAgICAgICAgICBub3RpZmllcjogcmV0cmlldmVOb3RpZmllcihvYmplY3QsIGRhdGEpXHJcbiAgICAgICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgaWYgKGdldERlc2NyaXB0b3IpIHtcclxuICAgICAgICAgICAgICAgIGRlc2NzID0gZGF0YS5kZXNjcmlwdG9ycyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgd2hpbGUgKGkgPCBwcm9wcy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgICAgICBkZXNjc1tpXSA9IGdldERlc2NyaXB0b3Iob2JqZWN0LCBwcm9wc1tpXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWVzW2ldID0gb2JqZWN0W3Byb3BzW2krK11dO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGVsc2Ugd2hpbGUgKGkgPCBwcm9wcy5sZW5ndGgpXHJcbiAgICAgICAgICAgICAgICB2YWx1ZXNbaV0gPSBvYmplY3RbcHJvcHNbaSsrXV07XHJcblxyXG4gICAgICAgICAgICBvYnNlcnZlZC5zZXQob2JqZWN0LCBkYXRhKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBkYXRhO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFBlcmZvcm1zIGJhc2ljIHByb3BlcnR5IHZhbHVlIGNoYW5nZSBjaGVja3Mgb24gYW4gb2JzZXJ2ZWQgb2JqZWN0XHJcbiAgICAgICAgICogQGZ1bmN0aW9uIHBlcmZvcm1Qcm9wZXJ0eUNoZWNrc1xyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0RGF0YX0gZGF0YVxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gW2V4Y2VwdF0gIERvZXNuJ3QgZGVsaXZlciB0aGUgY2hhbmdlcyB0byB0aGVcclxuICAgICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZXJzIHRoYXQgYWNjZXB0IHRoaXMgdHlwZVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHBlcmZvcm1Qcm9wZXJ0eUNoZWNrcyA9IChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgdmFyIHVwZGF0ZUNoZWNrID0gZ2V0RGVzY3JpcHRvciA/IGZ1bmN0aW9uKG9iamVjdCwgZGF0YSwgaWR4LCBleGNlcHQsIGRlc2NyKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIga2V5ID0gZGF0YS5wcm9wZXJ0aWVzW2lkeF0sXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBvYmplY3Rba2V5XSxcclxuICAgICAgICAgICAgICAgICAgICBvdmFsdWUgPSBkYXRhLnZhbHVlc1tpZHhdLFxyXG4gICAgICAgICAgICAgICAgICAgIG9kZXNjID0gZGF0YS5kZXNjcmlwdG9yc1tpZHhdO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmIChcInZhbHVlXCIgaW4gZGVzY3IgJiYgKG92YWx1ZSA9PT0gdmFsdWVcclxuICAgICAgICAgICAgICAgICAgICAgICAgPyBvdmFsdWUgPT09IDAgJiYgMS9vdmFsdWUgIT09IDEvdmFsdWUgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDogb3ZhbHVlID09PSBvdmFsdWUgfHwgdmFsdWUgPT09IHZhbHVlKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGFkZENoYW5nZVJlY29yZChvYmplY3QsIGRhdGEsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZToga2V5LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcInVwZGF0ZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmplY3Q6IG9iamVjdCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWU6IG92YWx1ZVxyXG4gICAgICAgICAgICAgICAgICAgIH0sIGV4Y2VwdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YS52YWx1ZXNbaWR4XSA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKG9kZXNjLmNvbmZpZ3VyYWJsZSAmJiAoIWRlc2NyLmNvbmZpZ3VyYWJsZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB8fCBkZXNjci53cml0YWJsZSAhPT0gb2Rlc2Mud3JpdGFibGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgfHwgZGVzY3IuZW51bWVyYWJsZSAhPT0gb2Rlc2MuZW51bWVyYWJsZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB8fCBkZXNjci5nZXQgIT09IG9kZXNjLmdldFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB8fCBkZXNjci5zZXQgIT09IG9kZXNjLnNldCkpIHtcclxuICAgICAgICAgICAgICAgICAgICBhZGRDaGFuZ2VSZWNvcmQob2JqZWN0LCBkYXRhLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGtleSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJyZWNvbmZpZ3VyZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmplY3Q6IG9iamVjdCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWU6IG92YWx1ZVxyXG4gICAgICAgICAgICAgICAgICAgIH0sIGV4Y2VwdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5kZXNjcmlwdG9yc1tpZHhdID0gZGVzY3I7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gOiBmdW5jdGlvbihvYmplY3QsIGRhdGEsIGlkeCwgZXhjZXB0KSB7XHJcbiAgICAgICAgICAgICAgICB2YXIga2V5ID0gZGF0YS5wcm9wZXJ0aWVzW2lkeF0sXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBvYmplY3Rba2V5XSxcclxuICAgICAgICAgICAgICAgICAgICBvdmFsdWUgPSBkYXRhLnZhbHVlc1tpZHhdO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmIChvdmFsdWUgPT09IHZhbHVlID8gb3ZhbHVlID09PSAwICYmIDEvb3ZhbHVlICE9PSAxL3ZhbHVlIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA6IG92YWx1ZSA9PT0gb3ZhbHVlIHx8IHZhbHVlID09PSB2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGFkZENoYW5nZVJlY29yZChvYmplY3QsIGRhdGEsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZToga2V5LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcInVwZGF0ZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmplY3Q6IG9iamVjdCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWU6IG92YWx1ZVxyXG4gICAgICAgICAgICAgICAgICAgIH0sIGV4Y2VwdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YS52YWx1ZXNbaWR4XSA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgLy8gQ2hlY2tzIGlmIHNvbWUgcHJvcGVydHkgaGFzIGJlZW4gZGVsZXRlZFxyXG4gICAgICAgICAgICB2YXIgZGVsZXRpb25DaGVjayA9IGdldERlc2NyaXB0b3IgPyBmdW5jdGlvbihvYmplY3QsIHByb3BzLCBwcm9wbGVuLCBkYXRhLCBleGNlcHQpIHtcclxuICAgICAgICAgICAgICAgIHZhciBpID0gcHJvcHMubGVuZ3RoLCBkZXNjcjtcclxuICAgICAgICAgICAgICAgIHdoaWxlIChwcm9wbGVuICYmIGktLSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9wc1tpXSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjciA9IGdldERlc2NyaXB0b3Iob2JqZWN0LCBwcm9wc1tpXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BsZW4tLTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIHRoZXJlJ3Mgbm8gZGVzY3JpcHRvciwgdGhlIHByb3BlcnR5IGhhcyByZWFsbHlcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYmVlbiBkZWxldGVkOyBvdGhlcndpc2UsIGl0J3MgYmVlbiByZWNvbmZpZ3VyZWQgc29cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhhdCdzIG5vdCBlbnVtZXJhYmxlIGFueW1vcmVcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRlc2NyKSB1cGRhdGVDaGVjayhvYmplY3QsIGRhdGEsIGksIGV4Y2VwdCwgZGVzY3IpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZENoYW5nZVJlY29yZChvYmplY3QsIGRhdGEsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBwcm9wc1tpXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcImRlbGV0ZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdDogb2JqZWN0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlOiBkYXRhLnZhbHVlc1tpXVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgZXhjZXB0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEucHJvcGVydGllcy5zcGxpY2UoaSwgMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhLnZhbHVlcy5zcGxpY2UoaSwgMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhLmRlc2NyaXB0b3JzLnNwbGljZShpLCAxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSA6IGZ1bmN0aW9uKG9iamVjdCwgcHJvcHMsIHByb3BsZW4sIGRhdGEsIGV4Y2VwdCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGkgPSBwcm9wcy5sZW5ndGg7XHJcbiAgICAgICAgICAgICAgICB3aGlsZSAocHJvcGxlbiAmJiBpLS0pXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BzW2ldICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZENoYW5nZVJlY29yZChvYmplY3QsIGRhdGEsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHByb3BzW2ldLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJkZWxldGVcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdDogb2JqZWN0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWU6IGRhdGEudmFsdWVzW2ldXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIGV4Y2VwdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEucHJvcGVydGllcy5zcGxpY2UoaSwgMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEudmFsdWVzLnNwbGljZShpLCAxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGxlbi0tO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihkYXRhLCBvYmplY3QsIGV4Y2VwdCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFkYXRhLmhhbmRsZXJzLnNpemUgfHwgZGF0YS5mcm96ZW4pIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgcHJvcHMsIHByb3BsZW4sIGtleXMsXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWVzID0gZGF0YS52YWx1ZXMsXHJcbiAgICAgICAgICAgICAgICAgICAgZGVzY3MgPSBkYXRhLmRlc2NyaXB0b3JzLFxyXG4gICAgICAgICAgICAgICAgICAgIGkgPSAwLCBpZHgsXHJcbiAgICAgICAgICAgICAgICAgICAga2V5LCB2YWx1ZSxcclxuICAgICAgICAgICAgICAgICAgICBwcm90bywgZGVzY3I7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gSWYgdGhlIG9iamVjdCBpc24ndCBleHRlbnNpYmxlLCB3ZSBkb24ndCBuZWVkIHRvIGNoZWNrIGZvciBuZXdcclxuICAgICAgICAgICAgICAgIC8vIG9yIGRlbGV0ZWQgcHJvcGVydGllc1xyXG4gICAgICAgICAgICAgICAgaWYgKGRhdGEuZXh0ZW5zaWJsZSkge1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBwcm9wcyA9IGRhdGEucHJvcGVydGllcy5zbGljZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHByb3BsZW4gPSBwcm9wcy5sZW5ndGg7XHJcbiAgICAgICAgICAgICAgICAgICAga2V5cyA9IGdldFByb3BzKG9iamVjdCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChkZXNjcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB3aGlsZSAoaSA8IGtleXMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXkgPSBrZXlzW2krK107XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZHggPSBpbkFycmF5KHByb3BzLCBrZXkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3IgPSBnZXREZXNjcmlwdG9yKG9iamVjdCwga2V5KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWR4ID09PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZENoYW5nZVJlY29yZChvYmplY3QsIGRhdGEsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZToga2V5LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcImFkZFwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmplY3Q6IG9iamVjdFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIGV4Y2VwdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YS5wcm9wZXJ0aWVzLnB1c2goa2V5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXMucHVzaChvYmplY3Rba2V5XSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3MucHVzaChkZXNjcik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BzW2lkeF0gPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BsZW4tLTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVDaGVjayhvYmplY3QsIGRhdGEsIGlkeCwgZXhjZXB0LCBkZXNjcik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRpb25DaGVjayhvYmplY3QsIHByb3BzLCBwcm9wbGVuLCBkYXRhLCBleGNlcHQpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFPLmlzRXh0ZW5zaWJsZShvYmplY3QpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhLmV4dGVuc2libGUgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZENoYW5nZVJlY29yZChvYmplY3QsIGRhdGEsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcInByZXZlbnRFeHRlbnNpb25zXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiBvYmplY3RcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIGV4Y2VwdCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YS5mcm96ZW4gPSBPLmlzRnJvemVuKG9iamVjdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB3aGlsZSAoaSA8IGtleXMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXkgPSBrZXlzW2krK107XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZHggPSBpbkFycmF5KHByb3BzLCBrZXkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBvYmplY3Rba2V5XTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWR4ID09PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZENoYW5nZVJlY29yZChvYmplY3QsIGRhdGEsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZToga2V5LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcImFkZFwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmplY3Q6IG9iamVjdFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIGV4Y2VwdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YS5wcm9wZXJ0aWVzLnB1c2goa2V5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXMucHVzaCh2YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BzW2lkeF0gPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BsZW4tLTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVDaGVjayhvYmplY3QsIGRhdGEsIGlkeCwgZXhjZXB0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGlvbkNoZWNrKG9iamVjdCwgcHJvcHMsIHByb3BsZW4sIGRhdGEsIGV4Y2VwdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIWRhdGEuZnJvemVuKSB7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHRoZSBvYmplY3QgaXMgbm90IGV4dGVuc2libGUsIGJ1dCBub3QgZnJvemVuLCB3ZSBqdXN0IGhhdmVcclxuICAgICAgICAgICAgICAgICAgICAvLyB0byBjaGVjayBmb3IgdmFsdWUgY2hhbmdlc1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAoOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAga2V5ID0gcHJvcHNbaV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZUNoZWNrKG9iamVjdCwgZGF0YSwgaSwgZXhjZXB0LCBnZXREZXNjcmlwdG9yKG9iamVjdCwga2V5KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoTy5pc0Zyb3plbihvYmplY3QpKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhLmZyb3plbiA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKGdldFByb3RvdHlwZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHByb3RvID0gZ2V0UHJvdG90eXBlKG9iamVjdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3RvICE9PSBkYXRhLnByb3RvKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZENoYW5nZVJlY29yZChvYmplY3QsIGRhdGEsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwic2V0UHJvdG90eXBlXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBcIl9fcHJvdG9fX1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiBvYmplY3QsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZTogZGF0YS5wcm90b1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YS5wcm90byA9IHByb3RvO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9KSgpLFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBTZXRzIHVwIHRoZSBtYWluIGxvb3AgZm9yIG9iamVjdCBvYnNlcnZhdGlvbiBhbmQgY2hhbmdlIG5vdGlmaWNhdGlvblxyXG4gICAgICAgICAqIEl0IHN0b3BzIGlmIG5vIG9iamVjdCBpcyBvYnNlcnZlZC5cclxuICAgICAgICAgKiBAZnVuY3Rpb24gcnVuR2xvYmFsTG9vcFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHJ1bkdsb2JhbExvb3AgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgaWYgKG9ic2VydmVkLnNpemUpIHtcclxuICAgICAgICAgICAgICAgIG9ic2VydmVkLmZvckVhY2gocGVyZm9ybVByb3BlcnR5Q2hlY2tzKTtcclxuICAgICAgICAgICAgICAgIGhhbmRsZXJzLmZvckVhY2goZGVsaXZlckhhbmRsZXJSZWNvcmRzKTtcclxuICAgICAgICAgICAgICAgIG5leHRGcmFtZShydW5HbG9iYWxMb29wKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIERlbGl2ZXIgdGhlIGNoYW5nZSByZWNvcmRzIHJlbGF0aXZlIHRvIGEgY2VydGFpbiBoYW5kbGVyLCBhbmQgcmVzZXRzXHJcbiAgICAgICAgICogdGhlIHJlY29yZCBsaXN0LlxyXG4gICAgICAgICAqIEBwYXJhbSB7SGFuZGxlckRhdGF9IGhkYXRhXHJcbiAgICAgICAgICogQHBhcmFtIHtIYW5kbGVyfSBoYW5kbGVyXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZGVsaXZlckhhbmRsZXJSZWNvcmRzID0gZnVuY3Rpb24oaGRhdGEsIGhhbmRsZXIpIHtcclxuICAgICAgICAgICAgaWYgKGhkYXRhLmNoYW5nZVJlY29yZHMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICBoYW5kbGVyKGhkYXRhLmNoYW5nZVJlY29yZHMpO1xyXG4gICAgICAgICAgICAgICAgaGRhdGEuY2hhbmdlUmVjb3JkcyA9IFtdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogUmV0dXJucyB0aGUgbm90aWZpZXIgZm9yIGFuIG9iamVjdCAtIHdoZXRoZXIgaXQncyBvYnNlcnZlZCBvciBub3RcclxuICAgICAgICAgKiBAZnVuY3Rpb24gcmV0cmlldmVOb3RpZmllclxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdERhdGF9IFtkYXRhXVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtOb3RpZmllcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICByZXRyaWV2ZU5vdGlmaWVyID0gZnVuY3Rpb24ob2JqZWN0LCBkYXRhKSB7XHJcbiAgICAgICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMilcclxuICAgICAgICAgICAgICAgIGRhdGEgPSBvYnNlcnZlZC5nZXQob2JqZWN0KTtcclxuXHJcbiAgICAgICAgICAgIC8qKiBAdHlwZSB7Tm90aWZpZXJ9ICovXHJcbiAgICAgICAgICAgIHJldHVybiBkYXRhICYmIGRhdGEubm90aWZpZXIgfHwge1xyXG4gICAgICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAgICAgKiBAbWV0aG9kIG5vdGlmeVxyXG4gICAgICAgICAgICAgICAgICogQHNlZSBodHRwOi8vYXJ2LmdpdGh1Yi5pby9lY21hc2NyaXB0LW9iamVjdC1vYnNlcnZlLyNub3RpZmllcnByb3RvdHlwZS5fbm90aWZ5XHJcbiAgICAgICAgICAgICAgICAgKiBAbWVtYmVyb2YgTm90aWZpZXJcclxuICAgICAgICAgICAgICAgICAqIEBwYXJhbSB7Q2hhbmdlUmVjb3JkfSBjaGFuZ2VSZWNvcmRcclxuICAgICAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICAgICAgbm90aWZ5OiBmdW5jdGlvbihjaGFuZ2VSZWNvcmQpIHtcclxuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VSZWNvcmQudHlwZTsgLy8gSnVzdCB0byBjaGVjayB0aGUgcHJvcGVydHkgaXMgdGhlcmUuLi5cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgdGhlcmUncyBubyBkYXRhLCB0aGUgb2JqZWN0IGhhcyBiZWVuIHVub2JzZXJ2ZWRcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZGF0YSA9IG9ic2VydmVkLmdldChvYmplY3QpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChkYXRhKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZWNvcmRDb3B5ID0geyBvYmplY3Q6IG9iamVjdCB9LCBwcm9wO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHByb3AgaW4gY2hhbmdlUmVjb3JkKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByb3AgIT09IFwib2JqZWN0XCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVjb3JkQ29weVtwcm9wXSA9IGNoYW5nZVJlY29yZFtwcm9wXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWRkQ2hhbmdlUmVjb3JkKG9iamVjdCwgZGF0YSwgcmVjb3JkQ29weSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICAgICAqIEBtZXRob2QgcGVyZm9ybUNoYW5nZVxyXG4gICAgICAgICAgICAgICAgICogQHNlZSBodHRwOi8vYXJ2LmdpdGh1Yi5pby9lY21hc2NyaXB0LW9iamVjdC1vYnNlcnZlLyNub3RpZmllcnByb3RvdHlwZV8ucGVyZm9ybWNoYW5nZVxyXG4gICAgICAgICAgICAgICAgICogQG1lbWJlcm9mIE5vdGlmaWVyXHJcbiAgICAgICAgICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gY2hhbmdlVHlwZVxyXG4gICAgICAgICAgICAgICAgICogQHBhcmFtIHtQZXJmb3JtZXJ9IGZ1bmMgICAgIFRoZSB0YXNrIHBlcmZvcm1lclxyXG4gICAgICAgICAgICAgICAgICogQHBhcmFtIHsqfSBbdGhpc09ial0gICAgICAgIFVzZWQgdG8gc2V0IGB0aGlzYCB3aGVuIGNhbGxpbmcgZnVuY1xyXG4gICAgICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgICAgICBwZXJmb3JtQ2hhbmdlOiBmdW5jdGlvbihjaGFuZ2VUeXBlLCBmdW5jLyosIHRoaXNPYmoqLykge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY2hhbmdlVHlwZSAhPT0gXCJzdHJpbmdcIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkludmFsaWQgbm9uLXN0cmluZyBjaGFuZ2VUeXBlXCIpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGZ1bmMgIT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCBwZXJmb3JtIG5vbi1mdW5jdGlvblwiKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgdGhlcmUncyBubyBkYXRhLCB0aGUgb2JqZWN0IGhhcyBiZWVuIHVub2JzZXJ2ZWRcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZGF0YSA9IG9ic2VydmVkLmdldChvYmplY3QpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wLCBjaGFuZ2VSZWNvcmQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGZ1bmMuY2FsbChhcmd1bWVudHNbMl0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBkYXRhICYmIHBlcmZvcm1Qcm9wZXJ0eUNoZWNrcyhkYXRhLCBvYmplY3QsIGNoYW5nZVR5cGUpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBJZiB0aGVyZSdzIG5vIGRhdGEsIHRoZSBvYmplY3QgaGFzIGJlZW4gdW5vYnNlcnZlZFxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChkYXRhICYmIHJlc3VsdCAmJiB0eXBlb2YgcmVzdWx0ID09PSBcIm9iamVjdFwiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZVJlY29yZCA9IHsgb2JqZWN0OiBvYmplY3QsIHR5cGU6IGNoYW5nZVR5cGUgfTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChwcm9wIGluIHJlc3VsdClcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcm9wICE9PSBcIm9iamVjdFwiICYmIHByb3AgIT09IFwidHlwZVwiKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZVJlY29yZFtwcm9wXSA9IHJlc3VsdFtwcm9wXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWRkQ2hhbmdlUmVjb3JkKG9iamVjdCwgZGF0YSwgY2hhbmdlUmVjb3JkKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogUmVnaXN0ZXIgKG9yIHJlZGVmaW5lcykgYW4gaGFuZGxlciBpbiB0aGUgY29sbGVjdGlvbiBmb3IgYSBnaXZlblxyXG4gICAgICAgICAqIG9iamVjdCBhbmQgYSBnaXZlbiB0eXBlIGFjY2VwdCBsaXN0LlxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBzZXRIYW5kbGVyXHJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0RGF0YX0gZGF0YVxyXG4gICAgICAgICAqIEBwYXJhbSB7SGFuZGxlcn0gaGFuZGxlclxyXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nW119IGFjY2VwdExpc3RcclxuICAgICAgICAgKi9cclxuICAgICAgICBzZXRIYW5kbGVyID0gZnVuY3Rpb24ob2JqZWN0LCBkYXRhLCBoYW5kbGVyLCBhY2NlcHRMaXN0KSB7XHJcbiAgICAgICAgICAgIHZhciBoZGF0YSA9IGhhbmRsZXJzLmdldChoYW5kbGVyKSwgb2RhdGE7XHJcbiAgICAgICAgICAgIGlmICghaGRhdGEpXHJcbiAgICAgICAgICAgICAgICBoYW5kbGVycy5zZXQoaGFuZGxlciwgaGRhdGEgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgb2JzZXJ2ZWQ6IGNyZWF0ZU1hcCgpLFxyXG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZVJlY29yZHM6IFtdXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgaGRhdGEub2JzZXJ2ZWQuc2V0KG9iamVjdCwge1xyXG4gICAgICAgICAgICAgICAgYWNjZXB0TGlzdDogYWNjZXB0TGlzdC5zbGljZSgpLFxyXG4gICAgICAgICAgICAgICAgZGF0YTogZGF0YVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgZGF0YS5oYW5kbGVycy5zZXQoaGFuZGxlciwgaGRhdGEpO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEFkZHMgYSBjaGFuZ2UgcmVjb3JkIGluIGEgZ2l2ZW4gT2JqZWN0RGF0YVxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBhZGRDaGFuZ2VSZWNvcmRcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XHJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3REYXRhfSBkYXRhXHJcbiAgICAgICAgICogQHBhcmFtIHtDaGFuZ2VSZWNvcmR9IGNoYW5nZVJlY29yZFxyXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBbZXhjZXB0XVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFkZENoYW5nZVJlY29yZCA9IGZ1bmN0aW9uKG9iamVjdCwgZGF0YSwgY2hhbmdlUmVjb3JkLCBleGNlcHQpIHtcclxuICAgICAgICAgICAgZGF0YS5oYW5kbGVycy5mb3JFYWNoKGZ1bmN0aW9uKGhkYXRhKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgYWNjZXB0TGlzdCA9IGhkYXRhLm9ic2VydmVkLmdldChvYmplY3QpLmFjY2VwdExpc3Q7XHJcbiAgICAgICAgICAgICAgICAvLyBJZiBleGNlcHQgaXMgZGVmaW5lZCwgTm90aWZpZXIucGVyZm9ybUNoYW5nZSBoYXMgYmVlblxyXG4gICAgICAgICAgICAgICAgLy8gY2FsbGVkLCB3aXRoIGV4Y2VwdCBhcyB0aGUgdHlwZS5cclxuICAgICAgICAgICAgICAgIC8vIEFsbCB0aGUgaGFuZGxlcnMgdGhhdCBhY2NlcHRzIHRoYXQgdHlwZSBhcmUgc2tpcHBlZC5cclxuICAgICAgICAgICAgICAgIGlmICgodHlwZW9mIGV4Y2VwdCAhPT0gXCJzdHJpbmdcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB8fCBpbkFycmF5KGFjY2VwdExpc3QsIGV4Y2VwdCkgPT09IC0xKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAmJiBpbkFycmF5KGFjY2VwdExpc3QsIGNoYW5nZVJlY29yZC50eXBlKSA+IC0xKVxyXG4gICAgICAgICAgICAgICAgICAgIGhkYXRhLmNoYW5nZVJlY29yZHMucHVzaChjaGFuZ2VSZWNvcmQpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9O1xyXG5cclxuICAgIG9ic2VydmVkID0gY3JlYXRlTWFwKCk7XHJcbiAgICBoYW5kbGVycyA9IGNyZWF0ZU1hcCgpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQGZ1bmN0aW9uIE9iamVjdC5vYnNlcnZlXHJcbiAgICAgKiBAc2VlIGh0dHA6Ly9hcnYuZ2l0aHViLmlvL2VjbWFzY3JpcHQtb2JqZWN0LW9ic2VydmUvI09iamVjdC5vYnNlcnZlXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XHJcbiAgICAgKiBAcGFyYW0ge0hhbmRsZXJ9IGhhbmRsZXJcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nW119IFthY2NlcHRMaXN0XVxyXG4gICAgICogQHRocm93cyB7VHlwZUVycm9yfVxyXG4gICAgICogQHJldHVybnMge09iamVjdH0gICAgICAgICAgICAgICBUaGUgb2JzZXJ2ZWQgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIE8ub2JzZXJ2ZSA9IGZ1bmN0aW9uIG9ic2VydmUob2JqZWN0LCBoYW5kbGVyLCBhY2NlcHRMaXN0KSB7XHJcbiAgICAgICAgaWYgKCFvYmplY3QgfHwgdHlwZW9mIG9iamVjdCAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2Ygb2JqZWN0ICE9PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3Qub2JzZXJ2ZSBjYW5ub3Qgb2JzZXJ2ZSBub24tb2JqZWN0XCIpO1xyXG5cclxuICAgICAgICBpZiAodHlwZW9mIGhhbmRsZXIgIT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdC5vYnNlcnZlIGNhbm5vdCBkZWxpdmVyIHRvIG5vbi1mdW5jdGlvblwiKTtcclxuXHJcbiAgICAgICAgaWYgKE8uaXNGcm96ZW4gJiYgTy5pc0Zyb3plbihoYW5kbGVyKSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdC5vYnNlcnZlIGNhbm5vdCBkZWxpdmVyIHRvIGEgZnJvemVuIGZ1bmN0aW9uIG9iamVjdFwiKTtcclxuXHJcbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAyKSB7XHJcbiAgICAgICAgICAgIGlmICghYWNjZXB0TGlzdCB8fCB0eXBlb2YgYWNjZXB0TGlzdCAhPT0gXCJvYmplY3RcIilcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3Qub2JzZXJ2ZSBjYW5ub3QgdXNlIG5vbi1vYmplY3QgYWNjZXB0IGxpc3RcIik7XHJcbiAgICAgICAgfSBlbHNlIGFjY2VwdExpc3QgPSBkZWZhdWx0QWNjZXB0TGlzdDtcclxuXHJcbiAgICAgICAgZG9PYnNlcnZlKG9iamVjdCwgaGFuZGxlciwgYWNjZXB0TGlzdCk7XHJcblxyXG4gICAgICAgIHJldHVybiBvYmplY3Q7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQGZ1bmN0aW9uIE9iamVjdC51bm9ic2VydmVcclxuICAgICAqIEBzZWUgaHR0cDovL2Fydi5naXRodWIuaW8vZWNtYXNjcmlwdC1vYmplY3Qtb2JzZXJ2ZS8jT2JqZWN0LnVub2JzZXJ2ZVxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxyXG4gICAgICogQHBhcmFtIHtIYW5kbGVyfSBoYW5kbGVyXHJcbiAgICAgKiBAdGhyb3dzIHtUeXBlRXJyb3J9XHJcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSAgICAgICAgIFRoZSBnaXZlbiBvYmplY3RcclxuICAgICAqL1xyXG4gICAgTy51bm9ic2VydmUgPSBmdW5jdGlvbiB1bm9ic2VydmUob2JqZWN0LCBoYW5kbGVyKSB7XHJcbiAgICAgICAgaWYgKG9iamVjdCA9PT0gbnVsbCB8fCB0eXBlb2Ygb2JqZWN0ICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiBvYmplY3QgIT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdC51bm9ic2VydmUgY2Fubm90IHVub2JzZXJ2ZSBub24tb2JqZWN0XCIpO1xyXG5cclxuICAgICAgICBpZiAodHlwZW9mIGhhbmRsZXIgIT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdC51bm9ic2VydmUgY2Fubm90IGRlbGl2ZXIgdG8gbm9uLWZ1bmN0aW9uXCIpO1xyXG5cclxuICAgICAgICB2YXIgaGRhdGEgPSBoYW5kbGVycy5nZXQoaGFuZGxlciksIG9kYXRhO1xyXG5cclxuICAgICAgICBpZiAoaGRhdGEgJiYgKG9kYXRhID0gaGRhdGEub2JzZXJ2ZWQuZ2V0KG9iamVjdCkpKSB7XHJcbiAgICAgICAgICAgIGhkYXRhLm9ic2VydmVkLmZvckVhY2goZnVuY3Rpb24ob2RhdGEsIG9iamVjdCkge1xyXG4gICAgICAgICAgICAgICAgcGVyZm9ybVByb3BlcnR5Q2hlY2tzKG9kYXRhLmRhdGEsIG9iamVjdCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBuZXh0RnJhbWUoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICBkZWxpdmVySGFuZGxlclJlY29yZHMoaGRhdGEsIGhhbmRsZXIpO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIC8vIEluIEZpcmVmb3ggMTMtMTgsIHNpemUgaXMgYSBmdW5jdGlvbiwgYnV0IGNyZWF0ZU1hcCBzaG91bGQgZmFsbFxyXG4gICAgICAgICAgICAvLyBiYWNrIHRvIHRoZSBzaGltIGZvciB0aG9zZSB2ZXJzaW9uc1xyXG4gICAgICAgICAgICBpZiAoaGRhdGEub2JzZXJ2ZWQuc2l6ZSA9PT0gMSAmJiBoZGF0YS5vYnNlcnZlZC5oYXMob2JqZWN0KSlcclxuICAgICAgICAgICAgICAgIGhhbmRsZXJzW1wiZGVsZXRlXCJdKGhhbmRsZXIpO1xyXG4gICAgICAgICAgICBlbHNlIGhkYXRhLm9ic2VydmVkW1wiZGVsZXRlXCJdKG9iamVjdCk7XHJcblxyXG4gICAgICAgICAgICBpZiAob2RhdGEuZGF0YS5oYW5kbGVycy5zaXplID09PSAxKVxyXG4gICAgICAgICAgICAgICAgb2JzZXJ2ZWRbXCJkZWxldGVcIl0ob2JqZWN0KTtcclxuICAgICAgICAgICAgZWxzZSBvZGF0YS5kYXRhLmhhbmRsZXJzW1wiZGVsZXRlXCJdKGhhbmRsZXIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIG9iamVjdDtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAZnVuY3Rpb24gT2JqZWN0LmdldE5vdGlmaWVyXHJcbiAgICAgKiBAc2VlIGh0dHA6Ly9hcnYuZ2l0aHViLmlvL2VjbWFzY3JpcHQtb2JqZWN0LW9ic2VydmUvI0dldE5vdGlmaWVyXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XHJcbiAgICAgKiBAdGhyb3dzIHtUeXBlRXJyb3J9XHJcbiAgICAgKiBAcmV0dXJucyB7Tm90aWZpZXJ9XHJcbiAgICAgKi9cclxuICAgIE8uZ2V0Tm90aWZpZXIgPSBmdW5jdGlvbiBnZXROb3RpZmllcihvYmplY3QpIHtcclxuICAgICAgICBpZiAob2JqZWN0ID09PSBudWxsIHx8IHR5cGVvZiBvYmplY3QgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIG9iamVjdCAhPT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0LmdldE5vdGlmaWVyIGNhbm5vdCBnZXROb3RpZmllciBub24tb2JqZWN0XCIpO1xyXG5cclxuICAgICAgICBpZiAoTy5pc0Zyb3plbiAmJiBPLmlzRnJvemVuKG9iamVjdCkpIHJldHVybiBudWxsO1xyXG5cclxuICAgICAgICByZXR1cm4gcmV0cmlldmVOb3RpZmllcihvYmplY3QpO1xyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEBmdW5jdGlvbiBPYmplY3QuZGVsaXZlckNoYW5nZVJlY29yZHNcclxuICAgICAqIEBzZWUgaHR0cDovL2Fydi5naXRodWIuaW8vZWNtYXNjcmlwdC1vYmplY3Qtb2JzZXJ2ZS8jT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzXHJcbiAgICAgKiBAc2VlIGh0dHA6Ly9hcnYuZ2l0aHViLmlvL2VjbWFzY3JpcHQtb2JqZWN0LW9ic2VydmUvI0RlbGl2ZXJDaGFuZ2VSZWNvcmRzXHJcbiAgICAgKiBAcGFyYW0ge0hhbmRsZXJ9IGhhbmRsZXJcclxuICAgICAqIEB0aHJvd3Mge1R5cGVFcnJvcn1cclxuICAgICAqL1xyXG4gICAgTy5kZWxpdmVyQ2hhbmdlUmVjb3JkcyA9IGZ1bmN0aW9uIGRlbGl2ZXJDaGFuZ2VSZWNvcmRzKGhhbmRsZXIpIHtcclxuICAgICAgICBpZiAodHlwZW9mIGhhbmRsZXIgIT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdC5kZWxpdmVyQ2hhbmdlUmVjb3JkcyBjYW5ub3QgZGVsaXZlciB0byBub24tZnVuY3Rpb25cIik7XHJcblxyXG4gICAgICAgIHZhciBoZGF0YSA9IGhhbmRsZXJzLmdldChoYW5kbGVyKTtcclxuICAgICAgICBpZiAoaGRhdGEpIHtcclxuICAgICAgICAgICAgaGRhdGEub2JzZXJ2ZWQuZm9yRWFjaChmdW5jdGlvbihvZGF0YSwgb2JqZWN0KSB7XHJcbiAgICAgICAgICAgICAgICBwZXJmb3JtUHJvcGVydHlDaGVja3Mob2RhdGEuZGF0YSwgb2JqZWN0KTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGRlbGl2ZXJIYW5kbGVyUmVjb3JkcyhoZGF0YSwgaGFuZGxlcik7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbn0pKE9iamVjdCwgQXJyYXksIHRoaXMpOyIsInZhciB0ZW1wbGF0aW5nID0gcmVxdWlyZShcImRyb29weS10ZW1wbGF0aW5nXCIpO1xyXG5cclxudmFyIEFycmF5QmluZGluZyA9IGZ1bmN0aW9uKGVsZW1lbnQsIGZ1bGxQcm9wZXJ0eSkge1xyXG5cdHRoaXMuZWxlbWVudCA9IGVsZW1lbnQ7XHJcblx0dGhpcy5vcmlnaW5hbCA9IGVsZW1lbnQuaW5uZXJIVE1MO1xyXG5cdHRoaXMuZnVsbFByb3BlcnR5ID0gZnVsbFByb3BlcnR5O1xyXG59O1xyXG5cclxuQXJyYXlCaW5kaW5nLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbihzY29wZSkge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHR2YXIgYXJyYXlIdG1sID0gXCJcIjtcclxuXHR2YXIgYXJyYXkgPSB0ZW1wbGF0aW5nLmdldE9iamVjdFZhbHVlKHNjb3BlLCBzZWxmLmZ1bGxQcm9wZXJ0eSk7XHJcblxyXG5cdGlmIChhcnJheSAmJiBBcnJheS5pc0FycmF5KGFycmF5KSkge1xyXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRhcnJheUh0bWwgKz0gdGVtcGxhdGluZy5wb3B1bGF0ZVRlbXBsYXRlKHNlbGYub3JpZ2luYWwsIGFycmF5W2ldLCB0ZW1wbGF0aW5nLkVhY2gucmVnRXhwKTtcclxuXHRcdH1cclxuXHR9XHJcblx0c2VsZi5lbGVtZW50LmlubmVySFRNTCA9IGFycmF5SHRtbDtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQXJyYXlCaW5kaW5nOyIsInZhciB0ZW1wbGF0aW5nID0gcmVxdWlyZShcImRyb29weS10ZW1wbGF0aW5nXCIpO1xyXG52YXIgTm9kZUJpbmRpbmcgPSByZXF1aXJlKFwiLi9ub2RlQmluZGluZ1wiKTtcclxudmFyIEFycmF5QmluZGluZyA9IHJlcXVpcmUoXCIuL2FycmF5QmluZGluZ1wiKTtcclxuXHJcbnZhciBEcm9vcHlCaW5kaW5nID0gZnVuY3Rpb24oY29udGFpbmVySWQsIG1vZGVsLCBzaG91bGRJbml0KSB7XHJcblx0dGhpcy5tb2RlbCA9IG1vZGVsO1xyXG5cdHRoaXMuY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoY29udGFpbmVySWQpO1xyXG5cclxuXHQvL0dldCBhbGwgYmluZGluZ3NcclxuXHR0aGlzLmJpbmRpbmdzID0gdGhpcy5nZXRCaW5kaW5ncyh0aGlzLmNvbnRhaW5lcik7XHJcblxyXG5cdGlmIChzaG91bGRJbml0ICE9PSBmYWxzZSkge1xyXG5cdFx0dGhpcy5pbml0KCk7XHJcblx0fVxyXG59O1xyXG5cclxuRHJvb3B5QmluZGluZy5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uKCkge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHRzZWxmLnVwZGF0ZUJpbmRpbmdzKCk7XHJcblx0c2VsZi5yZWN1cnNpdmVPYnNlcnZlKHNlbGYubW9kZWwsIFwiXCIsIGZ1bmN0aW9uKGNoYW5nZXMsIHByb3BDaGFpbikge1xyXG5cdFx0c2VsZi5oYW5kbGVPYmplY3RDaGFuZ2UoY2hhbmdlcywgcHJvcENoYWluKTtcclxuXHR9KTtcclxufTtcclxuXHJcbkRyb29weUJpbmRpbmcucHJvdG90eXBlLnJlY3Vyc2l2ZU9ic2VydmUgPSBmdW5jdGlvbihvYmosIHByb3BDaGFpbiwgY2FsbGJhY2spIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblx0Ly8gTWFrZSBzdXJlIGl0cyBhbiBhcnJheSBvciBvYmplY3RcclxuXHRpZiAoIUFycmF5LmlzQXJyYXkob2JqKSAmJiB0eXBlb2Ygb2JqICE9PSBcIm9iamVjdFwiKSByZXR1cm47XHJcblxyXG5cdGlmIChBcnJheS5pc0FycmF5KG9iaikpIHtcclxuXHRcdGlmIChBcnJheS5vYnNlcnZlKSB7XHJcblx0XHRcdEFycmF5Lm9ic2VydmUob2JqLCBmdW5jdGlvbihjaGFuZ2VzKSB7XHJcblx0XHRcdFx0c2VsZi5oYW5kbGVBcnJheUNoYW5nZShjaGFuZ2VzLCBwcm9wQ2hhaW4pO1xyXG5cdFx0XHR9KTtcdFx0XHRcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdE9iamVjdC5vYnNlcnZlKG9iaiwgZnVuY3Rpb24oY2hhbmdlcykge1xyXG5cdFx0XHRcdHNlbGYuaGFuZGxlQXJyYXlDaGFuZ2UoY2hhbmdlcywgcHJvcENoYWluKTtcclxuXHRcdFx0fSk7XHRcclxuXHRcdH1cclxuXHRcdC8vIFJlY3Vyc2l2ZWx5IG9ic2VydmUgYW55IGFycmF5IGl0ZW1zXHJcblx0XHRvYmouZm9yRWFjaChmdW5jdGlvbihhcnJheUl0ZW0sIGkpe1xyXG5cdFx0XHRzZWxmLnJlY3Vyc2l2ZU9ic2VydmUoYXJyYXlJdGVtLCBcIlwiLCBmdW5jdGlvbihjaGFuZ2VzKSB7IFxyXG5cdFx0XHRcdHNlbGYuaGFuZGxlQXJyYXlDaGFuZ2UuY2FsbChzZWxmLCBjaGFuZ2VzLCBwcm9wQ2hhaW4pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cclxuXHR9IGVsc2Uge1xyXG5cdFx0T2JqZWN0Lm9ic2VydmUob2JqLCBmdW5jdGlvbihjaGFuZ2VzKSB7XHJcblx0XHRcdGNhbGxiYWNrKGNoYW5nZXMsIHByb3BDaGFpbik7XHJcblx0XHR9KTtcclxuXHRcdFxyXG5cdFx0Ly8gUmVjdXJzaXZlbHkgb2JzZXJ2ZSBhbnkgY2hpbGQgb2JqZWN0c1xyXG5cdFx0T2JqZWN0LmtleXMob2JqKS5mb3JFYWNoKGZ1bmN0aW9uKHByb3BOYW1lKSB7XHJcblx0XHRcdHZhciBuZXdQcm9wQ2hhaW4gPSBwcm9wQ2hhaW47XHJcblx0XHRcdGlmIChuZXdQcm9wQ2hhaW4pIHtcclxuXHRcdFx0XHRuZXdQcm9wQ2hhaW4gKz0gXCIuXCIgKyBwcm9wTmFtZTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRuZXdQcm9wQ2hhaW4gPSBwcm9wTmFtZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRzZWxmLnJlY3Vyc2l2ZU9ic2VydmUob2JqW3Byb3BOYW1lXSwgbmV3UHJvcENoYWluLCBjYWxsYmFjayk7XHJcblx0XHR9KTtcclxuXHR9XHJcblx0XHJcbn07XHJcblxyXG5Ecm9vcHlCaW5kaW5nLnByb3RvdHlwZS5oYW5kbGVBcnJheUNoYW5nZSA9IGZ1bmN0aW9uKGNoYW5nZXMsIHByb3BDaGFpbikge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHJcblx0Ly8gUmUtb2JzZXJ2ZSBhbnkgbmV3IG9iamVjdHNcclxuXHRjaGFuZ2VzLmZvckVhY2goZnVuY3Rpb24oY2hhbmdlKXtcclxuXHRcdC8vSWYgaXRzIGFuIGFycmF5IGNoYW5nZSwgYW5kIGFuIHVwZGF0ZSwgaXRzIGEgbmV3IGluZGV4IGFzc2lnbm1lbnQgc28gcmUtb2JzZXJ2ZVxyXG5cdFx0aWYgKEFycmF5LmlzQXJyYXkoY2hhbmdlLm9iamVjdCkgJiYgY2hhbmdlLnR5cGUgPT09IFwidXBkYXRlXCIpIHtcclxuXHRcdFx0c2VsZi5yZWN1cnNpdmVPYnNlcnZlKGNoYW5nZS5vYmplY3RbY2hhbmdlLm5hbWVdLCBcIlwiLCBmdW5jdGlvbihjaGFuZ2VzKSB7IFxyXG5cdFx0XHRcdHNlbGYuaGFuZGxlQXJyYXlDaGFuZ2UuY2FsbChzZWxmLCBjaGFuZ2VzLCBwcm9wQ2hhaW4pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0gXHJcblx0XHQvLyBJZiBpdHMgYSBwdXNoIG9yIGEgcG9wIGl0IHdpbGwgY29tZSB0aHJvdWdoIGFzIHNwbGljZVxyXG5cdFx0ZWxzZSBpZiAoQXJyYXkuaXNBcnJheShjaGFuZ2Uub2JqZWN0KSAmJiBjaGFuZ2UudHlwZSA9PT0gXCJzcGxpY2VcIikge1xyXG5cdFx0XHQvLyBJZiBpdHMgYSBwdXNoLCBhZGRlZENvdW50IHdpbGwgYmUgMVxyXG5cdFx0XHRpZiAoY2hhbmdlLmFkZGVkQ291bnQgPiAwKSB7XHJcblx0XHRcdFx0Ly8gc3RhcnQgb2JzZXJ2aW5nIHRoZSBuZXcgYXJyYXkgaXRlbVxyXG5cdFx0XHRcdHNlbGYucmVjdXJzaXZlT2JzZXJ2ZShjaGFuZ2Uub2JqZWN0W2NoYW5nZS5pbmRleF0sIFwiXCIsIGZ1bmN0aW9uKGNoYW5nZXMpIHsgXHJcblx0XHRcdFx0XHRzZWxmLmhhbmRsZUFycmF5Q2hhbmdlLmNhbGwoc2VsZiwgY2hhbmdlcywgcHJvcENoYWluKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvLyBJZiBpdHMgYSBwb3Agd2UgcmVhbGx5IGRvbid0IGNhcmUgaGVyZSBiZWNhdXNlIHRoZXJlIGlzIG5vdGhpbmcgdG8gcmUtb2JzZXJ2ZVxyXG5cdFx0fVxyXG5cdH0pO1xyXG5cdC8vIFJlcmVuZGVyIGRhdGEtZWFjaCBiaW5kaW5ncyB0aGF0IGFyZSB0aWVkIHRvIHRoZSBhcnJheVxyXG5cdHNlbGYuYmluZGluZ3MuZm9yRWFjaChmdW5jdGlvbihiaW5kaW5nKSB7XHJcblx0XHRpZiAoYmluZGluZy5mdWxsUHJvcGVydHkgPT09IHByb3BDaGFpbikge1xyXG5cdFx0XHRiaW5kaW5nLnVwZGF0ZShzZWxmLm1vZGVsKTtcclxuXHRcdH1cclxuXHR9KTtcclxufTtcclxuXHJcbnZhciBfZmluZEJpbmRpbmdzID0gZnVuY3Rpb24oYmluZGluZ3MsIHByb3BlcnR5KSB7XHJcblx0cmV0dXJuIGJpbmRpbmdzLmZpbHRlcihmdW5jdGlvbihiaW5kaW5nKSB7XHJcblx0XHRyZXR1cm4gKGJpbmRpbmcuZnVsbFByb3BlcnR5LmluZGV4T2YocHJvcGVydHkpID09PSAwKVxyXG5cdH0pO1xyXG59O1xyXG5cclxuRHJvb3B5QmluZGluZy5wcm90b3R5cGUuaGFuZGxlT2JqZWN0Q2hhbmdlID0gZnVuY3Rpb24oY2hhbmdlcywgcHJvcENoYWluKSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cdGNoYW5nZXMuZm9yRWFjaChmdW5jdGlvbihjaGFuZ2UpIHtcclxuXHRcdC8vIEdldCB0aGUgcHJvcGVydHkgY2hhaW4gc3RyaW5nIHRvIHRpZSBiYWNrIHRvIFVJIHBsYWNlaG9sZGVyXHJcblx0XHR2YXIgY2hhbmdlZFByb3AgPSBjaGFuZ2UubmFtZTtcclxuXHRcdGlmIChwcm9wQ2hhaW4pIHtcclxuXHRcdFx0Y2hhbmdlZFByb3AgPSBwcm9wQ2hhaW4gKyBcIi5cIiArIGNoYW5nZS5uYW1lO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIENoZWNrIGVhY2ggYmluZGluZyB0byBzZWUgaWYgaXQgY2FyZXMsIHVwZGF0ZSBpZiBpdCBkb2VzXHJcblx0XHRfZmluZEJpbmRpbmdzKHNlbGYuYmluZGluZ3MsIGNoYW5nZWRQcm9wKS5mb3JFYWNoKGZ1bmN0aW9uKGJpbmRpbmcpe1xyXG5cdFx0XHRiaW5kaW5nLnVwZGF0ZShzZWxmLm1vZGVsKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdC8vIElmIG9iamVjdCBnZXRzIG92ZXJ3cml0dGVuLCBuZWVkIHRvIHJlLW9ic2VydmUgaXRcclxuXHRcdGlmIChjaGFuZ2UudHlwZSA9PT0gXCJ1cGRhdGVcIikge1xyXG5cdFx0XHRzZWxmLnJlY3Vyc2l2ZU9ic2VydmUoY2hhbmdlLm9iamVjdFtjaGFuZ2UubmFtZV0sIGNoYW5nZWRQcm9wLCBmdW5jdGlvbihjaGFuZ2VzLCBwcm9wQ2hhaW4pIHtcclxuXHRcdFx0XHRzZWxmLmhhbmRsZU9iamVjdENoYW5nZShjaGFuZ2VzLCBwcm9wQ2hhaW4pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHR9KTtcclxufTtcclxuXHJcbkRyb29weUJpbmRpbmcucHJvdG90eXBlLnVwZGF0ZUJpbmRpbmdzID0gZnVuY3Rpb24oKSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cdHNlbGYuYmluZGluZ3MuZm9yRWFjaChmdW5jdGlvbihiaW5kaW5nKSB7XHJcblx0XHRiaW5kaW5nLnVwZGF0ZShzZWxmLm1vZGVsKTtcclxuXHR9KTtcclxufTtcclxuXHJcbkRyb29weUJpbmRpbmcucHJvdG90eXBlLnVwZGF0ZU1vZGVsUHJvcGVydHkgPSBmdW5jdGlvbihmdWxsUHJvcGVydHksIG5ld1ZhbHVlKSB7XHJcblx0Ly9zdGFydCB3aXRoIHRoZSBtb2RlbFxyXG5cdHZhciBwcm9wZXJ0eUNoYWluID0gZnVsbFByb3BlcnR5LnNwbGl0KCcuJyk7XHJcblx0dmFyIHBhcmVudE9iaiA9IHRoaXMubW9kZWw7XHJcblx0dmFyIHByb3BlcnR5ID0gZnVsbFByb3BlcnR5O1xyXG5cdC8vdHJhdmVyc2UgdGhlIHByb3BlcnR5IGNoYWluLCBleGNlcHQgZm9yIGxhc3Qgb25lXHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wZXJ0eUNoYWluLmxlbmd0aCAtIDE7IGkrKykge1xyXG5cdFx0aWYgKHBhcmVudE9ialtwcm9wZXJ0eUNoYWluW2ldXSAhPSBudWxsKSB7XHJcblx0XHRcdHByb3BlcnR5ID0gcHJvcGVydHlDaGFpbltpXTtcclxuXHRcdFx0cGFyZW50T2JqID0gcGFyZW50T2JqW3Byb3BlcnR5XTtcclxuXHRcdH0gXHJcblx0fVxyXG5cdC8vaWYgaXRzIGFuIHVuZGVyc2NvcmUsIGl0cyByZWZlcmVuY2luZyB0aGUgbW9kZWwgc2NvcGVcclxuXHRpZihmdWxsUHJvcGVydHkgPT09IFwiX1wiKSB7XHJcblx0XHRwYXJlbnRPYmogPSBuZXdWYWx1ZTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0cHJvcGVydHkgPSBwcm9wZXJ0eUNoYWluW3Byb3BlcnR5Q2hhaW4ubGVuZ3RoIC0gMV07XHJcblx0XHRwYXJlbnRPYmpbcHJvcGVydHldID0gbmV3VmFsdWU7XHJcblx0fVxyXG59O1xyXG5cclxuRHJvb3B5QmluZGluZy5wcm90b3R5cGUudXBkYXRlTW9kZWwgPSBmdW5jdGlvbihuZXdNb2RlbCkge1xyXG5cdHRoaXMubW9kZWwgPSBuZXdNb2RlbDtcclxuXHR0aGlzLmluaXQoKTtcclxufTtcclxuXHJcbkRyb29weUJpbmRpbmcucHJvdG90eXBlLmdldEJpbmRpbmdzID0gZnVuY3Rpb24oZWxlbWVudCkge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHR2YXIgYmluZGluZ3MgPSBbXTtcclxuXHR2YXIgcGxhY2Vob2xkZXJzID0gW107XHJcblx0dmFyIGkgPSAwO1xyXG5cdC8vIDEuIExvb2sgZm9yIGF0dHJpYnV0ZSBiaW5kaW5ncyBhbmQgYXJyYXkgYmluZGluZ3Mgb24gdGhlIGN1cnJlbnQgZWxlbWVudFxyXG5cdGlmIChlbGVtZW50LmF0dHJpYnV0ZXMpIHtcclxuXHRcdGZvciAoaSA9IDA7IGkgPCBlbGVtZW50LmF0dHJpYnV0ZXMubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0aWYgKGVsZW1lbnQuYXR0cmlidXRlc1tpXS5ub2RlTmFtZSA9PT0gXCJkYXRhLWVhY2hcIikge1xyXG5cdFx0XHRcdGJpbmRpbmdzLnB1c2gobmV3IEFycmF5QmluZGluZyhlbGVtZW50LCBlbGVtZW50LmF0dHJpYnV0ZXNbaV0ubm9kZVZhbHVlKSk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dmFyIGF0dHJpYnV0ZUJpbmRpbmdzID0gdGVtcGxhdGluZy5nZXRQbGFjZUhvbGRlcnMoZWxlbWVudC5hdHRyaWJ1dGVzW2ldLm5vZGVWYWx1ZSlcclxuXHRcdFx0XHRcdC5tYXAoZnVuY3Rpb24ocGxhY2Vob2xkZXIpIHtcclxuXHRcdFx0XHRcdFx0dmFyIGJpbmRpbmcgPSBuZXcgTm9kZUJpbmRpbmcoZWxlbWVudC5hdHRyaWJ1dGVzW2ldLCBwbGFjZWhvbGRlciwgZWxlbWVudCk7XHJcblx0XHRcdFx0XHRcdGJpbmRpbmcub24oXCJpbnB1dC1jaGFuZ2VcIiwgc2VsZi51cGRhdGVNb2RlbFByb3BlcnR5LmJpbmQoc2VsZikpO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gYmluZGluZztcclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdGJpbmRpbmdzID0gYmluZGluZ3MuY29uY2F0KGF0dHJpYnV0ZUJpbmRpbmdzKTtcdFx0XHRcdFxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cdC8vIDIuYSBJZiB0aGUgZWxlbWVudCBoYXMgY2hpbGRyZW4sIGl0IHdvbid0IGhhdmUgYSB0ZXh0IGJpbmRpbmcuIFJlY3Vyc2Ugb24gY2hpbGRyZW5cclxuXHRpZiAoZWxlbWVudC5jaGlsZE5vZGVzICYmIGVsZW1lbnQuY2hpbGROb2Rlcy5sZW5ndGgpIHtcclxuXHRcdC8vcmVjdXJzaXZlIGNhbGwgZm9yIGVhY2ggY2hpbGRub2RlXHJcblx0XHRmb3IgKGkgPSAwOyBpIDwgZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdGJpbmRpbmdzID0gYmluZGluZ3MuY29uY2F0KHNlbGYuZ2V0QmluZGluZ3MoZWxlbWVudC5jaGlsZE5vZGVzW2ldKSk7XHJcblx0XHR9XHJcblx0fSBlbHNlIHtcclxuXHRcdC8vIDIuYiBUaGUgZWxlbWVudCBkb2Vzbid0IGhhdmUgY2hpbGRyZW4gc28gbG9vayBmb3IgYSB0ZXh0IGJpbmRpbmdcclxuXHRcdHBsYWNlaG9sZGVycyA9IHRlbXBsYXRpbmcuZ2V0UGxhY2VIb2xkZXJzKGVsZW1lbnQudGV4dENvbnRlbnQpO1xyXG5cdFx0dmFyIHRleHRCaW5kaW5ncyA9IHBsYWNlaG9sZGVycy5tYXAoZnVuY3Rpb24ocGxhY2Vob2xkZXIpIHtcclxuXHRcdFx0dmFyIGJpbmRpbmcgPSBuZXcgTm9kZUJpbmRpbmcoZWxlbWVudCwgcGxhY2Vob2xkZXIsIGVsZW1lbnQucGFyZW50Tm9kZSk7XHJcblx0XHRcdGJpbmRpbmcub24oXCJpbnB1dC1jaGFuZ2VcIiwgc2VsZi51cGRhdGVNb2RlbFByb3BlcnR5LmJpbmQoc2VsZikpO1xyXG5cdFx0XHRyZXR1cm4gYmluZGluZztcclxuXHRcdH0pO1xyXG5cdFx0YmluZGluZ3MgPSBiaW5kaW5ncy5jb25jYXQodGV4dEJpbmRpbmdzKTtcclxuXHR9XHJcblx0cmV0dXJuIGJpbmRpbmdzO1xyXG59O1xyXG5cclxuRHJvb3B5QmluZGluZy5wcm90b3R5cGUuc3Vic2NyaWJlID0gZnVuY3Rpb24oZXZlbnQsIHByb3BlcnR5LCBjYWxsYmFjaykge1xyXG5cdHZhciBtYXRjaGVzID0gX2ZpbmRCaW5kaW5ncyh0aGlzLmJpbmRpbmdzLCBwcm9wZXJ0eSk7XHJcblx0Ly9UaGVyZSBjb3VsZCBiZSBtYW55IGJpbmRpbmdzIGZvciB0aGUgc2FtZSBwcm9wZXJ0eSwgd2Ugb25seSB3YW50IHRvIHN1cmZhY2Ugb25lIGV2ZW50IHRob3VnaFxyXG5cdGlmIChtYXRjaGVzICYmIG1hdGNoZXMubGVuZ3RoKSB7XHJcblx0XHRtYXRjaGVzWzBdLm9uKGV2ZW50LCBjYWxsYmFjayk7XHJcblx0fVxyXG59O1xyXG5cclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IERyb29weUJpbmRpbmc7IiwidmFyIHRlbXBsYXRpbmcgPSByZXF1aXJlKFwiZHJvb3B5LXRlbXBsYXRpbmdcIik7XHJcbnZhciBFdmVudGFibGUgPSByZXF1aXJlKFwiZHJvb3B5LWV2ZW50c1wiKTtcclxuXHJcbnZhciBOb2RlQmluZGluZyA9IGZ1bmN0aW9uKG5vZGUsIHBsYWNlaG9sZGVyLCBlbGVtZW50KSB7XHJcblx0RXZlbnRhYmxlLmNhbGwodGhpcyk7XHJcblx0dGhpcy5ub2RlID0gbm9kZTtcclxuXHR0aGlzLm9yaWdpbmFsID0gbm9kZS5ub2RlVmFsdWU7XHJcblx0dGhpcy5yYXcgPSBwbGFjZWhvbGRlcjtcclxuXHR0aGlzLmZ1bGxQcm9wZXJ0eSA9IHRoaXMucmF3LnNsaWNlKDIsIHRoaXMucmF3Lmxlbmd0aCAtIDIpO1xyXG5cdC8vaWYgbm8gZWxlbWVudCB3YXMgcGFzc2VkIGluLCBpdCBpcyBhIHRleHQgYmluZGluZywgb3RoZXJ3aXNlIGF0dHJpYnV0ZVxyXG5cdHRoaXMuZWxlbWVudCA9IGVsZW1lbnQgfHwgbm9kZTsgXHJcblx0dGhpcy5zZXR1cFR3b1dheSgpO1xyXG59O1xyXG5cclxuTm9kZUJpbmRpbmcucHJvdG90eXBlID0gbmV3IEV2ZW50YWJsZSgpO1xyXG5cclxuTm9kZUJpbmRpbmcucHJvdG90eXBlLnNldHVwVHdvV2F5ID0gZnVuY3Rpb24oKSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cdGlmICh0aGlzLmVsZW1lbnQgJiYgdGhpcy5lbGVtZW50LnRhZ05hbWUpIHtcclxuXHRcdHZhciBlbGVtZW50VHlwZSA9IHRoaXMuZWxlbWVudC50YWdOYW1lLnRvTG93ZXJDYXNlKCk7XHJcblx0XHQvLyBURVhUIEFSRUFcclxuXHRcdGlmIChlbGVtZW50VHlwZSA9PT0gXCJ0ZXh0YXJlYVwiKSB7XHJcblx0XHRcdHRoaXMuZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwiaW5wdXRcIiwgdGhpcy5vbklucHV0Q2hhbmdlLmJpbmQodGhpcykpO1xyXG5cclxuXHRcdH0gZWxzZSBpZiAodGhpcy5ub2RlLm5vZGVOYW1lID09PSBcInZhbHVlXCIpIHtcclxuXHRcdFx0Ly8gSU5QVVQgZWxlbWVudFxyXG5cdFx0XHRpZiAoZWxlbWVudFR5cGUgPT09IFwiaW5wdXRcIikge1xyXG5cdFx0XHRcdHRoaXMuZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwiaW5wdXRcIiwgdGhpcy5vbklucHV0Q2hhbmdlLmJpbmQodGhpcykpO1xyXG5cdFx0XHR9IFxyXG5cdFx0XHQvLyBTRUxFQ1QgZWxlbWVudFxyXG5cdFx0XHRlbHNlIGlmIChlbGVtZW50VHlwZSA9PT0gXCJzZWxlY3RcIikge1xyXG5cdFx0XHRcdHRoaXMuZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsIHRoaXMub25JbnB1dENoYW5nZS5iaW5kKHRoaXMpKTtcclxuXHRcdFx0XHRzZXRUaW1lb3V0KHRoaXMub25JbnB1dENoYW5nZS5iaW5kKHRoaXMpLCAxKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcbn07XHJcblxyXG5Ob2RlQmluZGluZy5wcm90b3R5cGUub25JbnB1dENoYW5nZSA9IGZ1bmN0aW9uKCkge1xyXG5cdC8vY2FsbGVkIHdpdGggYmluZCwgc28gJ3RoaXMnIGlzIGFjdHVhbGx5IHRoaXNcclxuXHR0aGlzLnRyaWdnZXIoXCJpbnB1dC1jaGFuZ2VcIiwgdGhpcy5mdWxsUHJvcGVydHksIHRoaXMuZWxlbWVudC52YWx1ZSApO1xyXG59O1xyXG5cclxuTm9kZUJpbmRpbmcucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKG1vZGVsKSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cdHNlbGYudHJpZ2dlcihcInVwZGF0aW5nXCIpO1xyXG5cdC8vc2tpcCBhIHRpY2sgaW4gZXZlbnQgbG9vcCB0byBsZXQgJ3VwZGF0aW5nJyBiZSBoYW5kbGVkIGJlZm9yZSB1cGRhdGVcclxuXHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIGh0bWwgPSB0ZW1wbGF0aW5nLnJlbmRlclRlbXBsYXRlKHNlbGYub3JpZ2luYWwsIG1vZGVsKTtcclxuXHRcdHNlbGYubm9kZS5ub2RlVmFsdWUgPSBodG1sO1xyXG5cdFx0aWYgKHNlbGYubm9kZS5ub2RlTmFtZSA9PT0gXCJ2YWx1ZVwiICYmIHNlbGYuZWxlbWVudCkge1xyXG5cdFx0XHRzZWxmLmVsZW1lbnQudmFsdWUgPSBodG1sO1xyXG5cdFx0fVxyXG5cdFx0c2VsZi50cmlnZ2VyKFwidXBkYXRlZFwiKTtcdFx0XHJcblx0fSwxKTtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gTm9kZUJpbmRpbmc7Il19
