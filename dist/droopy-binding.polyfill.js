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
var Eventable = require("droopy-events");

var DroopyBinding = function(containerId, model, options) {
	options = options || {};
	this.model = model;
	this.container = document.getElementById(containerId);
	this.observeArrayItems = options.observeArrayItems || false;
	//Get all bindings
	this.bindings = this.getBindings(this.container);
	Eventable.call(this);

	if (options.shouldInit !== false) {
		this.init();
	}
};

DroopyBinding.prototype = new Eventable();
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
		if (false && Array.observe) {
			Array.observe(obj, function(changes) {
				self.handleArrayChange(changes, propChain);
			});			
		} else {
			Object.observe(obj, function(changes) {
				self.handleArrayChange(changes, propChain);
			});	
		}
		if (this.observeArrayItems) {
			// Recursively observe any array items
			obj.forEach(function(arrayItem, i){
				self.recursiveObserve(arrayItem, "", function(changes) { 
					self.handleArrayChange.call(self, changes, propChain);
				});
			});			
		}
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
	var count = 0;
	// Re-observe any new objects
	changes.forEach(function(change){
		count++;
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

DroopyBinding.prototype.bindEvents = function(nodeBinding) {
	var self = this;
	nodeBinding.on("input-change", self.updateModelProperty.bind(self));
	nodeBinding.on("updating", function(fullProperty) {
		self.broadcast("updating", fullProperty);
	});
	nodeBinding.on("updated", function(fullProperty) {
		self.broadcast("updated", fullProperty);
	});
};

DroopyBinding.prototype.broadcast = function(event, fullProperty) {
	var properties = fullProperty.split(".");
	var propChain = "";
	for(var i = 0; i < properties.length; i++) {
		propChain = propChain + properties[i];
		this.trigger(event + "-" + propChain);
		propChain += ".";
	}
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
						self.bindEvents(binding);
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
			self.bindEvents(binding);
			return binding;
		});
		bindings = bindings.concat(textBindings);
	}
	return bindings;
};

DroopyBinding.prototype.subscribe = function(event, property, callback) {
	this.on(event + "-" + property, callback);
};



module.exports = DroopyBinding;
},{"./arrayBinding":5,"./nodeBinding":7,"droopy-events":2,"droopy-templating":3}],7:[function(require,module,exports){
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
				this.element.addEventListener("change", this.onInputChange.bind(this));
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
	self.trigger("updating", self.fullProperty);
	//skip a tick in event loop to let 'updating' be handled before update
		var html = templating.renderTemplate(self.original, model);
		self.node.nodeValue = html;
		if (self.node.nodeName === "value" && self.element) {
			if (self.element.value !== html) {
				self.element.value = html;
			}
		}
		self.trigger("updated", self.fullProperty);		
};

module.exports = NodeBinding;
},{"droopy-events":2,"droopy-templating":3}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkM6XFxnaXR3aXBcXGRyb29weS1iaW5kaW5nXFxub2RlX21vZHVsZXNcXGd1bHAtYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXItcGFja1xcX3ByZWx1ZGUuanMiLCJDOi9naXR3aXAvZHJvb3B5LWJpbmRpbmcvZW50cmllcy9mYWtlXzNkZDE2MTE2LmpzIiwiQzovZ2l0d2lwL2Ryb29weS1iaW5kaW5nL25vZGVfbW9kdWxlcy9kcm9vcHktZXZlbnRzL0V2ZW50QWdncmVnYXRvci5qcyIsIkM6L2dpdHdpcC9kcm9vcHktYmluZGluZy9ub2RlX21vZHVsZXMvZHJvb3B5LXRlbXBsYXRpbmcvZHJvb3B5LXRlbXBsYXRpbmcuanMiLCJDOi9naXR3aXAvZHJvb3B5LWJpbmRpbmcvbm9kZV9tb2R1bGVzL29iamVjdC5vYnNlcnZlL2Rpc3Qvb2JqZWN0LW9ic2VydmUuanMiLCJDOi9naXR3aXAvZHJvb3B5LWJpbmRpbmcvc3JjL2FycmF5QmluZGluZy5qcyIsIkM6L2dpdHdpcC9kcm9vcHktYmluZGluZy9zcmMvZHJvb3B5QmluZGluZy5qcyIsIkM6L2dpdHdpcC9kcm9vcHktYmluZGluZy9zcmMvbm9kZUJpbmRpbmcuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbnVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDck9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xudmFyIHBvbHlmaWxsID0gcmVxdWlyZShcIm9iamVjdC5vYnNlcnZlXCIpO1xyXG5nbG9iYWwuZHJvb3B5QmluZGluZyA9IHt9O1xyXG5nbG9iYWwuRHJvb3B5QmluZGluZyA9IHJlcXVpcmUoXCIuLi9zcmMvZHJvb3B5QmluZGluZ1wiKTtcclxuZXhwb3J0cy5Ecm9vcHlCaW5kaW5nID0gZ2xvYmFsLkRyb29weUJpbmRpbmc7XG59KS5jYWxsKHRoaXMsdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSIsInZhciBFdmVudEFnZ3JlZ2F0b3IgPSBmdW5jdGlvbigpIHtcclxuXHR0aGlzLmV2ZW50S2V5cyA9IHt9O1xyXG5cdHRoaXMubGFzdFN1YnNjcmlwdGlvbklkID0gLTE7XHJcbn07XHJcblxyXG5FdmVudEFnZ3JlZ2F0b3IucHJvdG90eXBlLm9uID0gZnVuY3Rpb24oa2V5LCBjYWxsYmFjaykge1xyXG5cdGlmICh0eXBlb2YgY2FsbGJhY2sgPT09IFwiZnVuY3Rpb25cIikge1xyXG5cdFx0aWYgKCF0aGlzLmV2ZW50S2V5c1trZXldKSB7XHJcblx0XHRcdHRoaXMuZXZlbnRLZXlzW2tleV0gPSB7XHJcblx0XHRcdFx0c3Vic2NyaXB0aW9uczoge31cclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHRcdHZhciB0b2tlbiA9ICgrK3RoaXMubGFzdFN1YnNjcmlwdGlvbklkKS50b1N0cmluZygpO1xyXG5cdFx0dGhpcy5ldmVudEtleXNba2V5XS5zdWJzY3JpcHRpb25zW3Rva2VuXSA9IGNhbGxiYWNrO1xyXG5cdFx0cmV0dXJuIHRva2VuO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG59O1xyXG5cclxuRXZlbnRBZ2dyZWdhdG9yLnByb3RvdHlwZS5vZmYgPSBmdW5jdGlvbihrZXksIHRva2VuT3JDYWxsYmFjaykge1xyXG5cdGlmICh0eXBlb2YgdG9rZW5PckNhbGxiYWNrID09PSAnZnVuY3Rpb24nKSB7XHJcblx0XHQvL0NhbGxiYWNrIHJlZmVyZW5jZSB3YXMgcGFzc2VkIGluIHNvIGZpbmQgdGhlIHN1YnNjcmlwdGlvbiB3aXRoIHRoZSBtYXRjaGluZyBmdW5jdGlvblxyXG5cdFx0aWYgKHRoaXMuZXZlbnRLZXlzW2tleV0pIHtcclxuXHRcdFx0dmFyIGV2ZW50U3Vic2NyaXB0aW9ucyA9IHRoaXMuZXZlbnRLZXlzW2tleV0uc3Vic2NyaXB0aW9ucztcclxuXHRcdFx0dmFyIG1hdGNoaW5nSWQgPSBudWxsO1xyXG5cdFx0XHQvL2ZvcmVhY2ggc3Vic2NyaXB0aW9uIHNlZSBpZiB0aGUgZnVuY3Rpb25zIG1hdGNoIGFuZCBzYXZlIHRoZSBrZXkgaWYgeWVzXHJcblx0XHRcdGZvciAodmFyIHN1YnNjcmlwdGlvbklkIGluIGV2ZW50U3Vic2NyaXB0aW9ucykge1xyXG5cdFx0XHRcdGlmIChldmVudFN1YnNjcmlwdGlvbnMuaGFzT3duUHJvcGVydHkoc3Vic2NyaXB0aW9uSWQpKSB7XHJcblx0XHRcdFx0XHRpZiAoZXZlbnRTdWJzY3JpcHRpb25zW3N1YnNjcmlwdGlvbklkXSA9PT0gdG9rZW5PckNhbGxiYWNrKSB7XHJcblx0XHRcdFx0XHRcdG1hdGNoaW5nSWQgPSBzdWJzY3JpcHRpb25JZDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKG1hdGNoaW5nSWQgIT09IG51bGwpIHtcclxuXHRcdFx0XHRkZWxldGUgZXZlbnRTdWJzY3JpcHRpb25zW21hdGNoaW5nSWRdO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSBlbHNlIHtcclxuXHRcdC8vVG9rZW4gd2FzIHBhc3NlZCBpblxyXG5cdFx0aWYgKHRoaXMuZXZlbnRLZXlzW2tleV0gJiYgdGhpcy5ldmVudEtleXNba2V5XS5zdWJzY3JpcHRpb25zW3Rva2VuT3JDYWxsYmFja10pIHtcclxuXHRcdFx0ZGVsZXRlIHRoaXMuZXZlbnRLZXlzW2tleV0uc3Vic2NyaXB0aW9uc1t0b2tlbk9yQ2FsbGJhY2tdO1xyXG5cdFx0fVxyXG5cdH1cclxufTtcclxuXHJcbkV2ZW50QWdncmVnYXRvci5wcm90b3R5cGUudHJpZ2dlciA9IGZ1bmN0aW9uKGtleSkge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHRpZiAoc2VsZi5ldmVudEtleXNba2V5XSkge1xyXG5cdFx0dmFyIHZhbHVlcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XHJcblx0XHQvL0lmIHBhc3NpbmcgbGVzcyB0aGFuIHZhbHVlcyBwYXNzIHRoZW0gaW5kaXZpZHVhbGx5XHJcblx0XHR2YXIgYTEgPSB2YWx1ZXNbMF0sXHJcblx0XHRcdGEyID0gdmFsdWVzWzFdLFxyXG5cdFx0XHRhMyA9IHZhbHVlc1syXTtcclxuXHRcdC8vRWxzZSBpZiBwYXNzaW5nIG1vcmUgdGhhbiAzIHZhbHVlcyBncm91cCBhcyBhbiBhcmdzIGFycmF5XHJcblx0XHRpZiAodmFsdWVzLmxlbmd0aCA+IDMpIHtcclxuXHRcdFx0YTEgPSB2YWx1ZXM7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIHN1YnNjcmlwdGlvbnMgPSBzZWxmLmV2ZW50S2V5c1trZXldLnN1YnNjcmlwdGlvbnM7XHJcblx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRmb3IgKHZhciB0b2tlbiBpbiBzdWJzY3JpcHRpb25zKSB7XHJcblx0XHRcdFx0aWYgKHN1YnNjcmlwdGlvbnMuaGFzT3duUHJvcGVydHkodG9rZW4pKSB7XHJcblx0XHRcdFx0XHRzdWJzY3JpcHRpb25zW3Rva2VuXShhMSwgYTIsIGEzKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0sIDApO1xyXG5cdH1cclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRXZlbnRBZ2dyZWdhdG9yOyIsInZhciB0ZW1wbGF0aW5nID0ge1xyXG5cclxuXHRQbGFjZWhvbGRlcjogZnVuY3Rpb24ocmF3KSB7XHJcblx0XHR0aGlzLnJhdyA9IHJhdztcclxuXHRcdHRoaXMuZnVsbFByb3BlcnR5ID0gcmF3LnNsaWNlKDIsIHJhdy5sZW5ndGggLSAyKTtcclxuXHR9LFxyXG5cclxuXHRnZXRQbGFjZUhvbGRlcnM6IGZ1bmN0aW9uKHRlbXBsYXRlLCByZWdleHApIHtcclxuXHRcdHZhciByZWdFeHBQYXR0ZXJuID0gcmVnZXhwIHx8IC9cXHtcXHtbXlxcfV0rXFx9XFx9Py9nO1xyXG5cdFx0dmFyIG1hdGNoZXMgPSB0ZW1wbGF0ZS5tYXRjaChyZWdFeHBQYXR0ZXJuKTtcclxuXHRcdHJldHVybiBtYXRjaGVzIHx8IFtdO1xyXG5cdH0sXHJcblxyXG5cdGdldE9iamVjdFZhbHVlOiBmdW5jdGlvbihvYmosIGZ1bGxQcm9wZXJ0eSkge1xyXG5cdFx0dmFyIHZhbHVlID0gb2JqLFxyXG5cdFx0XHRwcm9wZXJ0eUNoYWluID0gZnVsbFByb3BlcnR5LnNwbGl0KCcuJyk7XHJcblxyXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wZXJ0eUNoYWluLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdHZhciBwcm9wZXJ0eSA9IHByb3BlcnR5Q2hhaW5baV07XHJcblx0XHRcdHZhbHVlID0gdmFsdWVbcHJvcGVydHldICE9IG51bGwgPyB2YWx1ZVtwcm9wZXJ0eV0gOiBcIk5vdCBGb3VuZDogXCIgKyBmdWxsUHJvcGVydHk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYoZnVsbFByb3BlcnR5ID09PSBcIl9cIikge1xyXG5cdFx0XHR2YWx1ZSA9IG9iajtcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0aWYgKCh0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIpICYmIHZhbHVlLmluZGV4T2YoXCIvRGF0ZShcIikgIT09IC0xKSB7XHJcblx0XHRcdHZhciBkYXRlVmFsdWUgPSBVVENKc29uVG9EYXRlKHZhbHVlKTtcclxuXHRcdFx0dmFsdWUgPSBkYXRlVmFsdWUudG9Mb2NhbGVEYXRlU3RyaW5nKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHZhbHVlO1xyXG5cdH0sXHJcblxyXG5cdHBvcHVsYXRlVGVtcGxhdGU6IGZ1bmN0aW9uKHRlbXBsYXRlLCBpdGVtLCByZWdleHApIHtcclxuXHRcdHZhciBwbGFjZWhvbGRlcnMgPSB0aGlzLmdldFBsYWNlSG9sZGVycyh0ZW1wbGF0ZSwgcmVnZXhwKSB8fCBbXSxcclxuXHRcdFx0aXRlbUh0bWwgPSB0ZW1wbGF0ZTtcclxuXHJcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHBsYWNlaG9sZGVycy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHR2YXIgcGxhY2Vob2xkZXIgPSBuZXcgdGhpcy5QbGFjZWhvbGRlcihwbGFjZWhvbGRlcnNbaV0pO1xyXG5cdFx0XHRwbGFjZWhvbGRlci52YWwgPSB0aGlzLmdldE9iamVjdFZhbHVlKGl0ZW0sIHBsYWNlaG9sZGVyLmZ1bGxQcm9wZXJ0eSk7XHJcblx0XHRcdHZhciBwYXR0ZXJuID0gcGxhY2Vob2xkZXIucmF3LnJlcGxhY2UoXCJbXCIsIFwiXFxcXFtcIikucmVwbGFjZShcIl1cIiwgXCJcXFxcXVwiKTtcclxuXHRcdFx0dmFyIG1vZGlmaWVyID0gXCJnXCI7XHJcblx0XHRcdGl0ZW1IdG1sID0gaXRlbUh0bWwucmVwbGFjZShuZXcgUmVnRXhwKHBhdHRlcm4sIG1vZGlmaWVyKSwgcGxhY2Vob2xkZXIudmFsKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiBpdGVtSHRtbDtcclxuXHR9XHJcbn07XHJcblxyXG50ZW1wbGF0aW5nLkVhY2ggPSB7XHJcblxyXG5cdHJlZ0V4cDogL1xce1xcW1teXFxdXStcXF1cXH0/L2csXHJcblxyXG5cdHBvcHVsYXRlRWFjaFRlbXBsYXRlczogZnVuY3Rpb24oaXRlbUh0bWwsIGl0ZW0pIHtcclxuXHRcdHZhciAkaXRlbUh0bWwgPSAkKGl0ZW1IdG1sKSxcclxuXHRcdFx0ZWFjaFRlbXBsYXRlcyA9ICRpdGVtSHRtbC5maW5kKFwiW2RhdGEtZWFjaF1cIik7XHJcblxyXG5cdFx0ZWFjaFRlbXBsYXRlcy5lYWNoKGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR2YXIgYXJyYXlIdG1sID0gXCJcIixcclxuXHRcdFx0XHRpdGVtVGVtcGxhdGUgPSAkKHRoaXMpLmh0bWwoKSxcclxuXHRcdFx0XHRhcnJheVByb3AgPSAkKHRoaXMpLmRhdGEoXCJlYWNoXCIpLFxyXG5cdFx0XHRcdGFycmF5ID0gc3AudGVtcGxhdGluZy5nZXRPYmplY3RWYWx1ZShpdGVtLCBhcnJheVByb3ApO1xyXG5cclxuXHRcdFx0aWYgKGFycmF5ICE9IG51bGwgJiYgJC5pc0FycmF5KGFycmF5KSkge1xyXG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0XHRcdGFycmF5SHRtbCArPSB0ZW1wbGF0aW5nLnBvcHVsYXRlVGVtcGxhdGUoaXRlbVRlbXBsYXRlLCBhcnJheVtpXSwgdGVtcGxhdGluZy5FYWNoLnJlZ0V4cCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQkaXRlbUh0bWwuZmluZCgkKHRoaXMpKS5odG1sKGFycmF5SHRtbCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR2YXIgdGVtcCA9ICRpdGVtSHRtbC5jbG9uZSgpLndyYXAoXCI8ZGl2PlwiKTtcclxuXHRcdHJldHVybiB0ZW1wLnBhcmVudCgpLmh0bWwoKTtcclxuXHR9XHJcbn07XHJcblxyXG50ZW1wbGF0aW5nLnJlbmRlclRlbXBsYXRlID0gZnVuY3Rpb24odGVtcGxhdGUsIGl0ZW0sIHJlbmRlckVhY2hUZW1wbGF0ZSkge1xyXG5cdHZhciBpdGVtSHRtbCA9IHRlbXBsYXRpbmcucG9wdWxhdGVUZW1wbGF0ZSh0ZW1wbGF0ZSwgaXRlbSk7XHJcblx0aWYgKHJlbmRlckVhY2hUZW1wbGF0ZSkge1xyXG5cdFx0aXRlbUh0bWwgPSB0ZW1wbGF0aW5nLkVhY2gucG9wdWxhdGVFYWNoVGVtcGxhdGVzKGl0ZW1IdG1sLCBpdGVtKTtcclxuXHR9XHJcblx0cmV0dXJuIGl0ZW1IdG1sO1xyXG59O1xyXG5cclxudmFyIFVUQ0pzb25Ub0RhdGUgPSBmdW5jdGlvbihqc29uRGF0ZSkge1xyXG5cdHZhciB1dGNTdHIgPSBqc29uRGF0ZS5zdWJzdHJpbmcoanNvbkRhdGUuaW5kZXhPZihcIihcIikgKyAxKTtcclxuXHR1dGNTdHIgPSB1dGNTdHIuc3Vic3RyaW5nKDAsIHV0Y1N0ci5pbmRleE9mKFwiKVwiKSk7XHJcblxyXG5cdHZhciByZXR1cm5EYXRlID0gbmV3IERhdGUocGFyc2VJbnQodXRjU3RyLCAxMCkpO1xyXG5cdHZhciBob3VyT2Zmc2V0ID0gcmV0dXJuRGF0ZS5nZXRUaW1lem9uZU9mZnNldCgpIC8gNjA7XHJcblx0cmV0dXJuRGF0ZS5zZXRIb3VycyhyZXR1cm5EYXRlLmdldEhvdXJzKCkgKyBob3VyT2Zmc2V0KTtcclxuXHJcblx0cmV0dXJuIHJldHVybkRhdGU7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHRlbXBsYXRpbmc7IiwiLyohXHJcbiAqIE9iamVjdC5vYnNlcnZlIHBvbHlmaWxsIC0gdjAuMi4zXHJcbiAqIGJ5IE1hc3NpbW8gQXJ0aXp6dSAoTWF4QXJ0MjUwMSlcclxuICogXHJcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9NYXhBcnQyNTAxL29iamVjdC1vYnNlcnZlXHJcbiAqIFxyXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2VcclxuICogU2VlIExJQ0VOU0UgZm9yIGRldGFpbHNcclxuICovXHJcblxyXG4vLyBTb21lIHR5cGUgZGVmaW5pdGlvbnNcclxuLyoqXHJcbiAqIFRoaXMgcmVwcmVzZW50cyB0aGUgZGF0YSByZWxhdGl2ZSB0byBhbiBvYnNlcnZlZCBvYmplY3RcclxuICogQHR5cGVkZWYgIHtPYmplY3R9ICAgICAgICAgICAgICAgICAgICAgT2JqZWN0RGF0YVxyXG4gKiBAcHJvcGVydHkge01hcDxIYW5kbGVyLCBIYW5kbGVyRGF0YT59ICBoYW5kbGVyc1xyXG4gKiBAcHJvcGVydHkge1N0cmluZ1tdfSAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzXHJcbiAqIEBwcm9wZXJ0eSB7KltdfSAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlc1xyXG4gKiBAcHJvcGVydHkge0Rlc2NyaXB0b3JbXX0gICAgICAgICAgICAgICBkZXNjcmlwdG9yc1xyXG4gKiBAcHJvcGVydHkge05vdGlmaWVyfSAgICAgICAgICAgICAgICAgICBub3RpZmllclxyXG4gKiBAcHJvcGVydHkge0Jvb2xlYW59ICAgICAgICAgICAgICAgICAgICBmcm96ZW5cclxuICogQHByb3BlcnR5IHtCb29sZWFufSAgICAgICAgICAgICAgICAgICAgZXh0ZW5zaWJsZVxyXG4gKiBAcHJvcGVydHkge09iamVjdH0gICAgICAgICAgICAgICAgICAgICBwcm90b1xyXG4gKi9cclxuLyoqXHJcbiAqIEZ1bmN0aW9uIGRlZmluaXRpb24gb2YgYSBoYW5kbGVyXHJcbiAqIEBjYWxsYmFjayBIYW5kbGVyXHJcbiAqIEBwYXJhbSB7Q2hhbmdlUmVjb3JkW119ICAgICAgICAgICAgICAgIGNoYW5nZXNcclxuKi9cclxuLyoqXHJcbiAqIFRoaXMgcmVwcmVzZW50cyB0aGUgZGF0YSByZWxhdGl2ZSB0byBhbiBvYnNlcnZlZCBvYmplY3QgYW5kIG9uZSBvZiBpdHNcclxuICogaGFuZGxlcnNcclxuICogQHR5cGVkZWYgIHtPYmplY3R9ICAgICAgICAgICAgICAgICAgICAgSGFuZGxlckRhdGFcclxuICogQHByb3BlcnR5IHtNYXA8T2JqZWN0LCBPYnNlcnZlZERhdGE+fSAgb2JzZXJ2ZWRcclxuICogQHByb3BlcnR5IHtDaGFuZ2VSZWNvcmRbXX0gICAgICAgICAgICAgY2hhbmdlUmVjb3Jkc1xyXG4gKi9cclxuLyoqXHJcbiAqIEB0eXBlZGVmICB7T2JqZWN0fSAgICAgICAgICAgICAgICAgICAgIE9ic2VydmVkRGF0YVxyXG4gKiBAcHJvcGVydHkge1N0cmluZ1tdfSAgICAgICAgICAgICAgICAgICBhY2NlcHRMaXN0XHJcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0RGF0YX0gICAgICAgICAgICAgICAgIGRhdGFcclxuKi9cclxuLyoqXHJcbiAqIFR5cGUgZGVmaW5pdGlvbiBmb3IgYSBjaGFuZ2UuIEFueSBvdGhlciBwcm9wZXJ0eSBjYW4gYmUgYWRkZWQgdXNpbmdcclxuICogdGhlIG5vdGlmeSgpIG9yIHBlcmZvcm1DaGFuZ2UoKSBtZXRob2RzIG9mIHRoZSBub3RpZmllci5cclxuICogQHR5cGVkZWYgIHtPYmplY3R9ICAgICAgICAgICAgICAgICAgICAgQ2hhbmdlUmVjb3JkXHJcbiAqIEBwcm9wZXJ0eSB7U3RyaW5nfSAgICAgICAgICAgICAgICAgICAgIHR5cGVcclxuICogQHByb3BlcnR5IHtPYmplY3R9ICAgICAgICAgICAgICAgICAgICAgb2JqZWN0XHJcbiAqIEBwcm9wZXJ0eSB7U3RyaW5nfSAgICAgICAgICAgICAgICAgICAgIFtuYW1lXVxyXG4gKiBAcHJvcGVydHkgeyp9ICAgICAgICAgICAgICAgICAgICAgICAgICBbb2xkVmFsdWVdXHJcbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfSAgICAgICAgICAgICAgICAgICAgIFtpbmRleF1cclxuICovXHJcbi8qKlxyXG4gKiBUeXBlIGRlZmluaXRpb24gZm9yIGEgbm90aWZpZXIgKHdoYXQgT2JqZWN0LmdldE5vdGlmaWVyIHJldHVybnMpXHJcbiAqIEB0eXBlZGVmICB7T2JqZWN0fSAgICAgICAgICAgICAgICAgICAgIE5vdGlmaWVyXHJcbiAqIEBwcm9wZXJ0eSB7RnVuY3Rpb259ICAgICAgICAgICAgICAgICAgIG5vdGlmeVxyXG4gKiBAcHJvcGVydHkge0Z1bmN0aW9ufSAgICAgICAgICAgICAgICAgICBwZXJmb3JtQ2hhbmdlXHJcbiAqL1xyXG4vKipcclxuICogRnVuY3Rpb24gY2FsbGVkIHdpdGggTm90aWZpZXIucGVyZm9ybUNoYW5nZS4gSXQgbWF5IG9wdGlvbmFsbHkgcmV0dXJuIGFcclxuICogQ2hhbmdlUmVjb3JkIHRoYXQgZ2V0cyBhdXRvbWF0aWNhbGx5IG5vdGlmaWVkLCBidXQgYHR5cGVgIGFuZCBgb2JqZWN0YFxyXG4gKiBwcm9wZXJ0aWVzIGFyZSBvdmVycmlkZGVuLlxyXG4gKiBAY2FsbGJhY2sgUGVyZm9ybWVyXHJcbiAqIEByZXR1cm5zIHtDaGFuZ2VSZWNvcmR8dW5kZWZpbmVkfVxyXG4gKi9cclxuXHJcbk9iamVjdC5vYnNlcnZlIHx8IChmdW5jdGlvbihPLCBBLCByb290KSB7XHJcbiAgICBcInVzZSBzdHJpY3RcIjtcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogUmVsYXRlcyBvYnNlcnZlZCBvYmplY3RzIGFuZCB0aGVpciBkYXRhXHJcbiAgICAgICAgICogQHR5cGUge01hcDxPYmplY3QsIE9iamVjdERhdGF9XHJcbiAgICAgICAgICovXHJcbiAgICB2YXIgb2JzZXJ2ZWQsXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogTGlzdCBvZiBoYW5kbGVycyBhbmQgdGhlaXIgZGF0YVxyXG4gICAgICAgICAqIEB0eXBlIHtNYXA8SGFuZGxlciwgTWFwPE9iamVjdCwgSGFuZGxlckRhdGE+Pn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBoYW5kbGVycyxcclxuXHJcbiAgICAgICAgZGVmYXVsdEFjY2VwdExpc3QgPSBbIFwiYWRkXCIsIFwidXBkYXRlXCIsIFwiZGVsZXRlXCIsIFwicmVjb25maWd1cmVcIiwgXCJzZXRQcm90b3R5cGVcIiwgXCJwcmV2ZW50RXh0ZW5zaW9uc1wiIF07XHJcblxyXG4gICAgLy8gRnVuY3Rpb25zIGZvciBpbnRlcm5hbCB1c2FnZVxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBDaGVja3MgaWYgdGhlIGFyZ3VtZW50IGlzIGFuIEFycmF5IG9iamVjdC4gUG9seWZpbGxzIEFycmF5LmlzQXJyYXkuXHJcbiAgICAgICAgICogQGZ1bmN0aW9uIGlzQXJyYXlcclxuICAgICAgICAgKiBAcGFyYW0gez8qfSBvYmplY3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgIHZhciBpc0FycmF5ID0gQS5pc0FycmF5IHx8IChmdW5jdGlvbih0b1N0cmluZykge1xyXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKG9iamVjdCkgeyByZXR1cm4gdG9TdHJpbmcuY2FsbChvYmplY3QpID09PSBcIltvYmplY3QgQXJyYXldXCI7IH07XHJcbiAgICAgICAgfSkoTy5wcm90b3R5cGUudG9TdHJpbmcpLFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBSZXR1cm5zIHRoZSBpbmRleCBvZiBhbiBpdGVtIGluIGEgY29sbGVjdGlvbiwgb3IgLTEgaWYgbm90IGZvdW5kLlxyXG4gICAgICAgICAqIFVzZXMgdGhlIGdlbmVyaWMgQXJyYXkuaW5kZXhPZiBvciBBcnJheS5wcm90b3R5cGUuaW5kZXhPZiBpZiBhdmFpbGFibGUuXHJcbiAgICAgICAgICogQGZ1bmN0aW9uIGluQXJyYXlcclxuICAgICAgICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheVxyXG4gICAgICAgICAqIEBwYXJhbSB7Kn0gcGl2b3QgICAgICAgICAgIEl0ZW0gdG8gbG9vayBmb3JcclxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gW3N0YXJ0PTBdICBJbmRleCB0byBzdGFydCBmcm9tXHJcbiAgICAgICAgICogQHJldHVybnMge051bWJlcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbkFycmF5ID0gQS5wcm90b3R5cGUuaW5kZXhPZiA/IEEuaW5kZXhPZiB8fCBmdW5jdGlvbihhcnJheSwgcGl2b3QsIHN0YXJ0KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBBLnByb3RvdHlwZS5pbmRleE9mLmNhbGwoYXJyYXksIHBpdm90LCBzdGFydCk7XHJcbiAgICAgICAgfSA6IGZ1bmN0aW9uKGFycmF5LCBwaXZvdCwgc3RhcnQpIHtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IHN0YXJ0IHx8IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKylcclxuICAgICAgICAgICAgICAgIGlmIChhcnJheVtpXSA9PT0gcGl2b3QpXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGk7XHJcbiAgICAgICAgICAgIHJldHVybiAtMTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIE1hcCwgb3IgYSBNYXAtbGlrZSBvYmplY3QgaXMgTWFwIGlzIG5vdFxyXG4gICAgICAgICAqIHN1cHBvcnRlZCBvciBkb2Vzbid0IHN1cHBvcnQgZm9yRWFjaCgpXHJcbiAgICAgICAgICogQGZ1bmN0aW9uIGNyZWF0ZU1hcFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtNYXB9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgY3JlYXRlTWFwID0gdHlwZW9mIHJvb3QuTWFwID09PSBcInVuZGVmaW5lZFwiIHx8ICFNYXAucHJvdG90eXBlLmZvckVhY2ggPyBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgLy8gTGlnaHR3ZWlnaHQgc2hpbSBvZiBNYXAuIExhY2tzIGNsZWFyKCksIGVudHJpZXMoKSwga2V5cygpIGFuZFxyXG4gICAgICAgICAgICAvLyB2YWx1ZXMoKSAodGhlIGxhc3QgMyBub3Qgc3VwcG9ydGVkIGJ5IElFMTEsIHNvIGNhbid0IHVzZSB0aGVtKSxcclxuICAgICAgICAgICAgLy8gaXQgZG9lc24ndCBoYW5kbGUgdGhlIGNvbnN0cnVjdG9yJ3MgYXJndW1lbnQgKGxpa2UgSUUxMSkgYW5kIG9mXHJcbiAgICAgICAgICAgIC8vIGNvdXJzZSBpdCBkb2Vzbid0IHN1cHBvcnQgZm9yLi4ub2YuXHJcbiAgICAgICAgICAgIC8vIENocm9tZSAzMS0zNSBhbmQgRmlyZWZveCAxMy0yNCBoYXZlIGEgYmFzaWMgc3VwcG9ydCBvZiBNYXAsIGJ1dFxyXG4gICAgICAgICAgICAvLyB0aGV5IGxhY2sgZm9yRWFjaCgpLCBzbyB0aGVpciBuYXRpdmUgaW1wbGVtZW50YXRpb24gaXMgYmFkIGZvclxyXG4gICAgICAgICAgICAvLyB0aGlzIHBvbHlmaWxsLiAoQ2hyb21lIDM2KyBzdXBwb3J0cyBPYmplY3Qub2JzZXJ2ZS4pXHJcbiAgICAgICAgICAgIHZhciBrZXlzID0gW10sIHZhbHVlcyA9IFtdO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHNpemU6IDAsXHJcbiAgICAgICAgICAgICAgICBoYXM6IGZ1bmN0aW9uKGtleSkgeyByZXR1cm4gaW5BcnJheShrZXlzLCBrZXkpID4gLTE7IH0sXHJcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uKGtleSkgeyByZXR1cm4gdmFsdWVzW2luQXJyYXkoa2V5cywga2V5KV07IH0sXHJcbiAgICAgICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uKGtleSwgdmFsdWUpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgaSA9IGluQXJyYXkoa2V5cywga2V5KTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAga2V5cy5wdXNoKGtleSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlcy5wdXNoKHZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zaXplKys7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHZhbHVlc1tpXSA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIFwiZGVsZXRlXCI6IGZ1bmN0aW9uKGtleSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBpID0gaW5BcnJheShrZXlzLCBrZXkpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChpID4gLTEpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAga2V5cy5zcGxpY2UoaSwgMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlcy5zcGxpY2UoaSwgMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2l6ZS0tO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBmb3JFYWNoOiBmdW5jdGlvbihjYWxsYmFjay8qLCB0aGlzT2JqKi8pIHtcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwoYXJndW1lbnRzWzFdLCB2YWx1ZXNbaV0sIGtleXNbaV0sIHRoaXMpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gOiBmdW5jdGlvbigpIHsgcmV0dXJuIG5ldyBNYXAoKTsgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogU2ltcGxlIHNoaW0gZm9yIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzIHdoZW4gaXMgbm90IGF2YWlsYWJsZVxyXG4gICAgICAgICAqIE1pc3NlcyBjaGVja3Mgb24gb2JqZWN0LCBkb24ndCB1c2UgYXMgYSByZXBsYWNlbWVudCBvZiBPYmplY3Qua2V5cy9nZXRPd25Qcm9wZXJ0eU5hbWVzXHJcbiAgICAgICAgICogQGZ1bmN0aW9uIGdldFByb3BzXHJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtTdHJpbmdbXX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXRQcm9wcyA9IE8uZ2V0T3duUHJvcGVydHlOYW1lcyA/IChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgdmFyIGZ1bmMgPSBPLmdldE93blByb3BlcnR5TmFtZXM7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBhcmd1bWVudHMuY2FsbGVlO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBTdHJpY3QgbW9kZSBpcyBzdXBwb3J0ZWRcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBJbiBzdHJpY3QgbW9kZSwgd2UgY2FuJ3QgYWNjZXNzIHRvIFwiYXJndW1lbnRzXCIsIFwiY2FsbGVyXCIgYW5kXHJcbiAgICAgICAgICAgICAgICAvLyBcImNhbGxlZVwiIHByb3BlcnRpZXMgb2YgZnVuY3Rpb25zLiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lc1xyXG4gICAgICAgICAgICAgICAgLy8gcmV0dXJucyBbIFwicHJvdG90eXBlXCIsIFwibGVuZ3RoXCIsIFwibmFtZVwiIF0gaW4gRmlyZWZveDsgaXQgcmV0dXJuc1xyXG4gICAgICAgICAgICAgICAgLy8gXCJjYWxsZXJcIiBhbmQgXCJhcmd1bWVudHNcIiB0b28gaW4gQ2hyb21lIGFuZCBpbiBJbnRlcm5ldFxyXG4gICAgICAgICAgICAgICAgLy8gRXhwbG9yZXIsIHNvIHRob3NlIHZhbHVlcyBtdXN0IGJlIGZpbHRlcmVkLlxyXG4gICAgICAgICAgICAgICAgdmFyIGF2b2lkID0gKGZ1bmMoaW5BcnJheSkuam9pbihcIiBcIikgKyBcIiBcIikucmVwbGFjZSgvcHJvdG90eXBlIHxsZW5ndGggfG5hbWUgL2csIFwiXCIpLnNsaWNlKDAsIC0xKS5zcGxpdChcIiBcIik7XHJcbiAgICAgICAgICAgICAgICBpZiAoYXZvaWQubGVuZ3RoKSBmdW5jID0gZnVuY3Rpb24ob2JqZWN0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByb3BzID0gTy5nZXRPd25Qcm9wZXJ0eU5hbWVzKG9iamVjdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBvYmplY3QgPT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGo7IGkgPCBhdm9pZC5sZW5ndGg7KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKChqID0gaW5BcnJheShwcm9wcywgYXZvaWRbaSsrXSkpID4gLTEpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcHMuc3BsaWNlKGosIDEpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcHJvcHM7XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmdW5jO1xyXG4gICAgICAgIH0pKCkgOiBmdW5jdGlvbihvYmplY3QpIHtcclxuICAgICAgICAgICAgLy8gUG9vci1tb3V0aCB2ZXJzaW9uIHdpdGggZm9yLi4uaW4gKElFOC0pXHJcbiAgICAgICAgICAgIHZhciBwcm9wcyA9IFtdLCBwcm9wLCBob3A7XHJcbiAgICAgICAgICAgIGlmIChcImhhc093blByb3BlcnR5XCIgaW4gb2JqZWN0KSB7XHJcbiAgICAgICAgICAgICAgICBmb3IgKHByb3AgaW4gb2JqZWN0KVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChvYmplY3QuaGFzT3duUHJvcGVydHkocHJvcCkpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BzLnB1c2gocHJvcCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBob3AgPSBPLmhhc093blByb3BlcnR5O1xyXG4gICAgICAgICAgICAgICAgZm9yIChwcm9wIGluIG9iamVjdClcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaG9wLmNhbGwob2JqZWN0LCBwcm9wKSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcHMucHVzaChwcm9wKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gSW5zZXJ0aW5nIGEgY29tbW9uIG5vbi1lbnVtZXJhYmxlIHByb3BlcnR5IG9mIGFycmF5c1xyXG4gICAgICAgICAgICBpZiAoaXNBcnJheShvYmplY3QpKVxyXG4gICAgICAgICAgICAgICAgcHJvcHMucHVzaChcImxlbmd0aFwiKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBwcm9wcztcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBSZXR1cm4gdGhlIHByb3RvdHlwZSBvZiB0aGUgb2JqZWN0Li4uIGlmIGRlZmluZWQuXHJcbiAgICAgICAgICogQGZ1bmN0aW9uIGdldFByb3RvdHlwZVxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldFByb3RvdHlwZSA9IE8uZ2V0UHJvdG90eXBlT2YsXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFJldHVybiB0aGUgZGVzY3JpcHRvciBvZiB0aGUgb2JqZWN0Li4uIGlmIGRlZmluZWQuXHJcbiAgICAgICAgICogSUU4IHN1cHBvcnRzIGEgKHVzZWxlc3MpIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IgZm9yIERPTVxyXG4gICAgICAgICAqIG5vZGVzIG9ubHksIHNvIGRlZmluZVByb3BlcnRpZXMgaXMgY2hlY2tlZCBpbnN0ZWFkLlxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBnZXREZXNjcmlwdG9yXHJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxyXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wZXJ0eVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtEZXNjcmlwdG9yfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldERlc2NyaXB0b3IgPSBPLmRlZmluZVByb3BlcnRpZXMgJiYgTy5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IsXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFNldHMgdXAgdGhlIG5leHQgY2hlY2sgYW5kIGRlbGl2ZXJpbmcgaXRlcmF0aW9uLCB1c2luZ1xyXG4gICAgICAgICAqIHJlcXVlc3RBbmltYXRpb25GcmFtZSBvciBhIChjbG9zZSkgcG9seWZpbGwuXHJcbiAgICAgICAgICogQGZ1bmN0aW9uIG5leHRGcmFtZVxyXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IGZ1bmNcclxuICAgICAgICAgKiBAcmV0dXJucyB7bnVtYmVyfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG5leHRGcmFtZSA9IHJvb3QucmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8IHJvb3Qud2Via2l0UmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8IChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgdmFyIGluaXRpYWwgPSArbmV3IERhdGUsXHJcbiAgICAgICAgICAgICAgICBsYXN0ID0gaW5pdGlhbDtcclxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGZ1bmMpIHtcclxuICAgICAgICAgICAgICAgIHZhciBub3cgPSArbmV3IERhdGU7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICBmdW5jKChsYXN0ID0gK25ldyBEYXRlKSAtIGluaXRpYWwpO1xyXG4gICAgICAgICAgICAgICAgfSwgMTcpO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0pKCksXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFNldHMgdXAgdGhlIG9ic2VydmF0aW9uIG9mIGFuIG9iamVjdFxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBkb09ic2VydmVcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XHJcbiAgICAgICAgICogQHBhcmFtIHtIYW5kbGVyfSBoYW5kbGVyXHJcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmdbXX0gW2FjY2VwdExpc3RdXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZG9PYnNlcnZlID0gZnVuY3Rpb24ob2JqZWN0LCBoYW5kbGVyLCBhY2NlcHRMaXN0KSB7XHJcblxyXG4gICAgICAgICAgICB2YXIgZGF0YSA9IG9ic2VydmVkLmdldChvYmplY3QpO1xyXG5cclxuICAgICAgICAgICAgaWYgKGRhdGEpXHJcbiAgICAgICAgICAgICAgICBzZXRIYW5kbGVyKG9iamVjdCwgZGF0YSwgaGFuZGxlciwgYWNjZXB0TGlzdCk7XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgZGF0YSA9IGNyZWF0ZU9iamVjdERhdGEob2JqZWN0KTtcclxuICAgICAgICAgICAgICAgIHNldEhhbmRsZXIob2JqZWN0LCBkYXRhLCBoYW5kbGVyLCBhY2NlcHRMaXN0KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKG9ic2VydmVkLnNpemUgPT09IDEpXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gTGV0IHRoZSBvYnNlcnZhdGlvbiBiZWdpbiFcclxuICAgICAgICAgICAgICAgICAgICBuZXh0RnJhbWUocnVuR2xvYmFsTG9vcCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBDcmVhdGVzIHRoZSBpbml0aWFsIGRhdGEgZm9yIGFuIG9ic2VydmVkIG9iamVjdFxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBjcmVhdGVPYmplY3REYXRhXHJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGNyZWF0ZU9iamVjdERhdGEgPSBmdW5jdGlvbihvYmplY3QsIGRhdGEpIHtcclxuICAgICAgICAgICAgdmFyIHByb3BzID0gZ2V0UHJvcHMob2JqZWN0KSxcclxuICAgICAgICAgICAgICAgIHZhbHVlcyA9IFtdLCBkZXNjcywgaSA9IDAsXHJcbiAgICAgICAgICAgICAgICBkYXRhID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIGhhbmRsZXJzOiBjcmVhdGVNYXAoKSxcclxuICAgICAgICAgICAgICAgICAgICBmcm96ZW46IE8uaXNGcm96ZW4gPyBPLmlzRnJvemVuKG9iamVjdCkgOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICBleHRlbnNpYmxlOiBPLmlzRXh0ZW5zaWJsZSA/IE8uaXNFeHRlbnNpYmxlKG9iamVjdCkgOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgIHByb3RvOiBnZXRQcm90b3R5cGUgJiYgZ2V0UHJvdG90eXBlKG9iamVjdCksXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczogcHJvcHMsXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWVzOiB2YWx1ZXMsXHJcbiAgICAgICAgICAgICAgICAgICAgbm90aWZpZXI6IHJldHJpZXZlTm90aWZpZXIob2JqZWN0LCBkYXRhKVxyXG4gICAgICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIGlmIChnZXREZXNjcmlwdG9yKSB7XHJcbiAgICAgICAgICAgICAgICBkZXNjcyA9IGRhdGEuZGVzY3JpcHRvcnMgPSBbXTtcclxuICAgICAgICAgICAgICAgIHdoaWxlIChpIDwgcHJvcHMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZGVzY3NbaV0gPSBnZXREZXNjcmlwdG9yKG9iamVjdCwgcHJvcHNbaV0pO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlc1tpXSA9IG9iamVjdFtwcm9wc1tpKytdXTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBlbHNlIHdoaWxlIChpIDwgcHJvcHMubGVuZ3RoKVxyXG4gICAgICAgICAgICAgICAgdmFsdWVzW2ldID0gb2JqZWN0W3Byb3BzW2krK11dO1xyXG5cclxuICAgICAgICAgICAgb2JzZXJ2ZWQuc2V0KG9iamVjdCwgZGF0YSk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gZGF0YTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBQZXJmb3JtcyBiYXNpYyBwcm9wZXJ0eSB2YWx1ZSBjaGFuZ2UgY2hlY2tzIG9uIGFuIG9ic2VydmVkIG9iamVjdFxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBwZXJmb3JtUHJvcGVydHlDaGVja3NcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdERhdGF9IGRhdGFcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XHJcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IFtleGNlcHRdICBEb2Vzbid0IGRlbGl2ZXIgdGhlIGNoYW5nZXMgdG8gdGhlXHJcbiAgICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICBoYW5kbGVycyB0aGF0IGFjY2VwdCB0aGlzIHR5cGVcclxuICAgICAgICAgKi9cclxuICAgICAgICBwZXJmb3JtUHJvcGVydHlDaGVja3MgPSAoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHZhciB1cGRhdGVDaGVjayA9IGdldERlc2NyaXB0b3IgPyBmdW5jdGlvbihvYmplY3QsIGRhdGEsIGlkeCwgZXhjZXB0LCBkZXNjcikge1xyXG4gICAgICAgICAgICAgICAgdmFyIGtleSA9IGRhdGEucHJvcGVydGllc1tpZHhdLFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gb2JqZWN0W2tleV0sXHJcbiAgICAgICAgICAgICAgICAgICAgb3ZhbHVlID0gZGF0YS52YWx1ZXNbaWR4XSxcclxuICAgICAgICAgICAgICAgICAgICBvZGVzYyA9IGRhdGEuZGVzY3JpcHRvcnNbaWR4XTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoXCJ2YWx1ZVwiIGluIGRlc2NyICYmIChvdmFsdWUgPT09IHZhbHVlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgID8gb3ZhbHVlID09PSAwICYmIDEvb3ZhbHVlICE9PSAxL3ZhbHVlIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA6IG92YWx1ZSA9PT0gb3ZhbHVlIHx8IHZhbHVlID09PSB2YWx1ZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBhZGRDaGFuZ2VSZWNvcmQob2JqZWN0LCBkYXRhLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGtleSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJ1cGRhdGVcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiBvYmplY3QsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlOiBvdmFsdWVcclxuICAgICAgICAgICAgICAgICAgICB9LCBleGNlcHQpO1xyXG4gICAgICAgICAgICAgICAgICAgIGRhdGEudmFsdWVzW2lkeF0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmIChvZGVzYy5jb25maWd1cmFibGUgJiYgKCFkZXNjci5jb25maWd1cmFibGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgfHwgZGVzY3Iud3JpdGFibGUgIT09IG9kZXNjLndyaXRhYmxlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHx8IGRlc2NyLmVudW1lcmFibGUgIT09IG9kZXNjLmVudW1lcmFibGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgfHwgZGVzY3IuZ2V0ICE9PSBvZGVzYy5nZXRcclxuICAgICAgICAgICAgICAgICAgICAgICAgfHwgZGVzY3Iuc2V0ICE9PSBvZGVzYy5zZXQpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYWRkQ2hhbmdlUmVjb3JkKG9iamVjdCwgZGF0YSwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBrZXksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwicmVjb25maWd1cmVcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiBvYmplY3QsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlOiBvdmFsdWVcclxuICAgICAgICAgICAgICAgICAgICB9LCBleGNlcHQpO1xyXG4gICAgICAgICAgICAgICAgICAgIGRhdGEuZGVzY3JpcHRvcnNbaWR4XSA9IGRlc2NyO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IDogZnVuY3Rpb24ob2JqZWN0LCBkYXRhLCBpZHgsIGV4Y2VwdCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGtleSA9IGRhdGEucHJvcGVydGllc1tpZHhdLFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gb2JqZWN0W2tleV0sXHJcbiAgICAgICAgICAgICAgICAgICAgb3ZhbHVlID0gZGF0YS52YWx1ZXNbaWR4XTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAob3ZhbHVlID09PSB2YWx1ZSA/IG92YWx1ZSA9PT0gMCAmJiAxL292YWx1ZSAhPT0gMS92YWx1ZSBcclxuICAgICAgICAgICAgICAgICAgICAgICAgOiBvdmFsdWUgPT09IG92YWx1ZSB8fCB2YWx1ZSA9PT0gdmFsdWUpIHtcclxuICAgICAgICAgICAgICAgICAgICBhZGRDaGFuZ2VSZWNvcmQob2JqZWN0LCBkYXRhLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGtleSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJ1cGRhdGVcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiBvYmplY3QsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlOiBvdmFsdWVcclxuICAgICAgICAgICAgICAgICAgICB9LCBleGNlcHQpO1xyXG4gICAgICAgICAgICAgICAgICAgIGRhdGEudmFsdWVzW2lkeF0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIC8vIENoZWNrcyBpZiBzb21lIHByb3BlcnR5IGhhcyBiZWVuIGRlbGV0ZWRcclxuICAgICAgICAgICAgdmFyIGRlbGV0aW9uQ2hlY2sgPSBnZXREZXNjcmlwdG9yID8gZnVuY3Rpb24ob2JqZWN0LCBwcm9wcywgcHJvcGxlbiwgZGF0YSwgZXhjZXB0KSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgaSA9IHByb3BzLmxlbmd0aCwgZGVzY3I7XHJcbiAgICAgICAgICAgICAgICB3aGlsZSAocHJvcGxlbiAmJiBpLS0pIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAocHJvcHNbaV0gIT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3IgPSBnZXREZXNjcmlwdG9yKG9iamVjdCwgcHJvcHNbaV0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wbGVuLS07XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiB0aGVyZSdzIG5vIGRlc2NyaXB0b3IsIHRoZSBwcm9wZXJ0eSBoYXMgcmVhbGx5XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJlZW4gZGVsZXRlZDsgb3RoZXJ3aXNlLCBpdCdzIGJlZW4gcmVjb25maWd1cmVkIHNvXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoYXQncyBub3QgZW51bWVyYWJsZSBhbnltb3JlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkZXNjcikgdXBkYXRlQ2hlY2sob2JqZWN0LCBkYXRhLCBpLCBleGNlcHQsIGRlc2NyKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRDaGFuZ2VSZWNvcmQob2JqZWN0LCBkYXRhLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogcHJvcHNbaV0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJkZWxldGVcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmplY3Q6IG9iamVjdCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZTogZGF0YS52YWx1ZXNbaV1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIGV4Y2VwdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhLnByb3BlcnRpZXMuc3BsaWNlKGksIDEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YS52YWx1ZXMuc3BsaWNlKGksIDEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YS5kZXNjcmlwdG9ycy5zcGxpY2UoaSwgMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gOiBmdW5jdGlvbihvYmplY3QsIHByb3BzLCBwcm9wbGVuLCBkYXRhLCBleGNlcHQpIHtcclxuICAgICAgICAgICAgICAgIHZhciBpID0gcHJvcHMubGVuZ3RoO1xyXG4gICAgICAgICAgICAgICAgd2hpbGUgKHByb3BsZW4gJiYgaS0tKVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9wc1tpXSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRDaGFuZ2VSZWNvcmQob2JqZWN0LCBkYXRhLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBwcm9wc1tpXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwiZGVsZXRlXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmplY3Q6IG9iamVjdCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlOiBkYXRhLnZhbHVlc1tpXVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LCBleGNlcHQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhLnByb3BlcnRpZXMuc3BsaWNlKGksIDEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhLnZhbHVlcy5zcGxpY2UoaSwgMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BsZW4tLTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZGF0YSwgb2JqZWN0LCBleGNlcHQpIHtcclxuICAgICAgICAgICAgICAgIGlmICghZGF0YS5oYW5kbGVycy5zaXplIHx8IGRhdGEuZnJvemVuKSByZXR1cm47XHJcblxyXG4gICAgICAgICAgICAgICAgdmFyIHByb3BzLCBwcm9wbGVuLCBrZXlzLFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlcyA9IGRhdGEudmFsdWVzLFxyXG4gICAgICAgICAgICAgICAgICAgIGRlc2NzID0gZGF0YS5kZXNjcmlwdG9ycyxcclxuICAgICAgICAgICAgICAgICAgICBpID0gMCwgaWR4LFxyXG4gICAgICAgICAgICAgICAgICAgIGtleSwgdmFsdWUsXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvdG8sIGRlc2NyO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIElmIHRoZSBvYmplY3QgaXNuJ3QgZXh0ZW5zaWJsZSwgd2UgZG9uJ3QgbmVlZCB0byBjaGVjayBmb3IgbmV3XHJcbiAgICAgICAgICAgICAgICAvLyBvciBkZWxldGVkIHByb3BlcnRpZXNcclxuICAgICAgICAgICAgICAgIGlmIChkYXRhLmV4dGVuc2libGUpIHtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvcHMgPSBkYXRhLnByb3BlcnRpZXMuc2xpY2UoKTtcclxuICAgICAgICAgICAgICAgICAgICBwcm9wbGVuID0gcHJvcHMubGVuZ3RoO1xyXG4gICAgICAgICAgICAgICAgICAgIGtleXMgPSBnZXRQcm9wcyhvYmplY3QpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoZGVzY3MpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2hpbGUgKGkgPCBrZXlzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5ID0ga2V5c1tpKytdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWR4ID0gaW5BcnJheShwcm9wcywga2V5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyID0gZ2V0RGVzY3JpcHRvcihvYmplY3QsIGtleSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkeCA9PT0gLTEpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRDaGFuZ2VSZWNvcmQob2JqZWN0LCBkYXRhLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGtleSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJhZGRcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiBvYmplY3RcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBleGNlcHQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEucHJvcGVydGllcy5wdXNoKGtleSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzLnB1c2gob2JqZWN0W2tleV0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NzLnB1c2goZGVzY3IpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wc1tpZHhdID0gbnVsbDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wbGVuLS07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlQ2hlY2sob2JqZWN0LCBkYXRhLCBpZHgsIGV4Y2VwdCwgZGVzY3IpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0aW9uQ2hlY2sob2JqZWN0LCBwcm9wcywgcHJvcGxlbiwgZGF0YSwgZXhjZXB0KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghTy5pc0V4dGVuc2libGUob2JqZWN0KSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YS5leHRlbnNpYmxlID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRDaGFuZ2VSZWNvcmQob2JqZWN0LCBkYXRhLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJwcmV2ZW50RXh0ZW5zaW9uc1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdDogb2JqZWN0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBleGNlcHQpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEuZnJvemVuID0gTy5pc0Zyb3plbihvYmplY3QpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2hpbGUgKGkgPCBrZXlzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5ID0ga2V5c1tpKytdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWR4ID0gaW5BcnJheShwcm9wcywga2V5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlID0gb2JqZWN0W2tleV07XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkeCA9PT0gLTEpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRDaGFuZ2VSZWNvcmQob2JqZWN0LCBkYXRhLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGtleSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJhZGRcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiBvYmplY3RcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBleGNlcHQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEucHJvcGVydGllcy5wdXNoKGtleSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzLnB1c2godmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wc1tpZHhdID0gbnVsbDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wbGVuLS07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlQ2hlY2sob2JqZWN0LCBkYXRhLCBpZHgsIGV4Y2VwdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRpb25DaGVjayhvYmplY3QsIHByb3BzLCBwcm9wbGVuLCBkYXRhLCBleGNlcHQpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCFkYXRhLmZyb3plbikge1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBJZiB0aGUgb2JqZWN0IGlzIG5vdCBleHRlbnNpYmxlLCBidXQgbm90IGZyb3plbiwgd2UganVzdCBoYXZlXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gdG8gY2hlY2sgZm9yIHZhbHVlIGNoYW5nZXNcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleSA9IHByb3BzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVDaGVjayhvYmplY3QsIGRhdGEsIGksIGV4Y2VwdCwgZ2V0RGVzY3JpcHRvcihvYmplY3QsIGtleSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKE8uaXNGcm96ZW4ob2JqZWN0KSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YS5mcm96ZW4gPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGlmIChnZXRQcm90b3R5cGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBwcm90byA9IGdldFByb3RvdHlwZShvYmplY3QpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm90byAhPT0gZGF0YS5wcm90bykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRDaGFuZ2VSZWNvcmQob2JqZWN0LCBkYXRhLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcInNldFByb3RvdHlwZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogXCJfX3Byb3RvX19cIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdDogb2JqZWN0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWU6IGRhdGEucHJvdG9cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEucHJvdG8gPSBwcm90bztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSkoKSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogU2V0cyB1cCB0aGUgbWFpbiBsb29wIGZvciBvYmplY3Qgb2JzZXJ2YXRpb24gYW5kIGNoYW5nZSBub3RpZmljYXRpb25cclxuICAgICAgICAgKiBJdCBzdG9wcyBpZiBubyBvYmplY3QgaXMgb2JzZXJ2ZWQuXHJcbiAgICAgICAgICogQGZ1bmN0aW9uIHJ1bkdsb2JhbExvb3BcclxuICAgICAgICAgKi9cclxuICAgICAgICBydW5HbG9iYWxMb29wID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIGlmIChvYnNlcnZlZC5zaXplKSB7XHJcbiAgICAgICAgICAgICAgICBvYnNlcnZlZC5mb3JFYWNoKHBlcmZvcm1Qcm9wZXJ0eUNoZWNrcyk7XHJcbiAgICAgICAgICAgICAgICBoYW5kbGVycy5mb3JFYWNoKGRlbGl2ZXJIYW5kbGVyUmVjb3Jkcyk7XHJcbiAgICAgICAgICAgICAgICBuZXh0RnJhbWUocnVuR2xvYmFsTG9vcCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBEZWxpdmVyIHRoZSBjaGFuZ2UgcmVjb3JkcyByZWxhdGl2ZSB0byBhIGNlcnRhaW4gaGFuZGxlciwgYW5kIHJlc2V0c1xyXG4gICAgICAgICAqIHRoZSByZWNvcmQgbGlzdC5cclxuICAgICAgICAgKiBAcGFyYW0ge0hhbmRsZXJEYXRhfSBoZGF0YVxyXG4gICAgICAgICAqIEBwYXJhbSB7SGFuZGxlcn0gaGFuZGxlclxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGRlbGl2ZXJIYW5kbGVyUmVjb3JkcyA9IGZ1bmN0aW9uKGhkYXRhLCBoYW5kbGVyKSB7XHJcbiAgICAgICAgICAgIGlmIChoZGF0YS5jaGFuZ2VSZWNvcmRzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgaGFuZGxlcihoZGF0YS5jaGFuZ2VSZWNvcmRzKTtcclxuICAgICAgICAgICAgICAgIGhkYXRhLmNoYW5nZVJlY29yZHMgPSBbXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFJldHVybnMgdGhlIG5vdGlmaWVyIGZvciBhbiBvYmplY3QgLSB3aGV0aGVyIGl0J3Mgb2JzZXJ2ZWQgb3Igbm90XHJcbiAgICAgICAgICogQGZ1bmN0aW9uIHJldHJpZXZlTm90aWZpZXJcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XHJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3REYXRhfSBbZGF0YV1cclxuICAgICAgICAgKiBAcmV0dXJucyB7Tm90aWZpZXJ9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgcmV0cmlldmVOb3RpZmllciA9IGZ1bmN0aW9uKG9iamVjdCwgZGF0YSkge1xyXG4gICAgICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIpXHJcbiAgICAgICAgICAgICAgICBkYXRhID0gb2JzZXJ2ZWQuZ2V0KG9iamVjdCk7XHJcblxyXG4gICAgICAgICAgICAvKiogQHR5cGUge05vdGlmaWVyfSAqL1xyXG4gICAgICAgICAgICByZXR1cm4gZGF0YSAmJiBkYXRhLm5vdGlmaWVyIHx8IHtcclxuICAgICAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgICAgICogQG1ldGhvZCBub3RpZnlcclxuICAgICAgICAgICAgICAgICAqIEBzZWUgaHR0cDovL2Fydi5naXRodWIuaW8vZWNtYXNjcmlwdC1vYmplY3Qtb2JzZXJ2ZS8jbm90aWZpZXJwcm90b3R5cGUuX25vdGlmeVxyXG4gICAgICAgICAgICAgICAgICogQG1lbWJlcm9mIE5vdGlmaWVyXHJcbiAgICAgICAgICAgICAgICAgKiBAcGFyYW0ge0NoYW5nZVJlY29yZH0gY2hhbmdlUmVjb3JkXHJcbiAgICAgICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgICAgIG5vdGlmeTogZnVuY3Rpb24oY2hhbmdlUmVjb3JkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2hhbmdlUmVjb3JkLnR5cGU7IC8vIEp1c3QgdG8gY2hlY2sgdGhlIHByb3BlcnR5IGlzIHRoZXJlLi4uXHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHRoZXJlJ3Mgbm8gZGF0YSwgdGhlIG9iamVjdCBoYXMgYmVlbiB1bm9ic2VydmVkXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGEgPSBvYnNlcnZlZC5nZXQob2JqZWN0KTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVjb3JkQ29weSA9IHsgb2JqZWN0OiBvYmplY3QgfSwgcHJvcDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChwcm9wIGluIGNoYW5nZVJlY29yZClcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcm9wICE9PSBcIm9iamVjdFwiKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlY29yZENvcHlbcHJvcF0gPSBjaGFuZ2VSZWNvcmRbcHJvcF07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZENoYW5nZVJlY29yZChvYmplY3QsIGRhdGEsIHJlY29yZENvcHkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sXHJcblxyXG4gICAgICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAgICAgKiBAbWV0aG9kIHBlcmZvcm1DaGFuZ2VcclxuICAgICAgICAgICAgICAgICAqIEBzZWUgaHR0cDovL2Fydi5naXRodWIuaW8vZWNtYXNjcmlwdC1vYmplY3Qtb2JzZXJ2ZS8jbm90aWZpZXJwcm90b3R5cGVfLnBlcmZvcm1jaGFuZ2VcclxuICAgICAgICAgICAgICAgICAqIEBtZW1iZXJvZiBOb3RpZmllclxyXG4gICAgICAgICAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IGNoYW5nZVR5cGVcclxuICAgICAgICAgICAgICAgICAqIEBwYXJhbSB7UGVyZm9ybWVyfSBmdW5jICAgICBUaGUgdGFzayBwZXJmb3JtZXJcclxuICAgICAgICAgICAgICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNPYmpdICAgICAgICBVc2VkIHRvIHNldCBgdGhpc2Agd2hlbiBjYWxsaW5nIGZ1bmNcclxuICAgICAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICAgICAgcGVyZm9ybUNoYW5nZTogZnVuY3Rpb24oY2hhbmdlVHlwZSwgZnVuYy8qLCB0aGlzT2JqKi8pIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNoYW5nZVR5cGUgIT09IFwic3RyaW5nXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJJbnZhbGlkIG5vbi1zdHJpbmcgY2hhbmdlVHlwZVwiKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBmdW5jICE9PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgcGVyZm9ybSBub24tZnVuY3Rpb25cIik7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHRoZXJlJ3Mgbm8gZGF0YSwgdGhlIG9iamVjdCBoYXMgYmVlbiB1bm9ic2VydmVkXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGEgPSBvYnNlcnZlZC5nZXQob2JqZWN0KSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcCwgY2hhbmdlUmVjb3JkLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBmdW5jLmNhbGwoYXJndW1lbnRzWzJdKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YSAmJiBwZXJmb3JtUHJvcGVydHlDaGVja3MoZGF0YSwgb2JqZWN0LCBjaGFuZ2VUeXBlKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgdGhlcmUncyBubyBkYXRhLCB0aGUgb2JqZWN0IGhhcyBiZWVuIHVub2JzZXJ2ZWRcclxuICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YSAmJiByZXN1bHQgJiYgdHlwZW9mIHJlc3VsdCA9PT0gXCJvYmplY3RcIikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2VSZWNvcmQgPSB7IG9iamVjdDogb2JqZWN0LCB0eXBlOiBjaGFuZ2VUeXBlIH07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAocHJvcCBpbiByZXN1bHQpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocHJvcCAhPT0gXCJvYmplY3RcIiAmJiBwcm9wICE9PSBcInR5cGVcIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2VSZWNvcmRbcHJvcF0gPSByZXN1bHRbcHJvcF07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZENoYW5nZVJlY29yZChvYmplY3QsIGRhdGEsIGNoYW5nZVJlY29yZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFJlZ2lzdGVyIChvciByZWRlZmluZXMpIGFuIGhhbmRsZXIgaW4gdGhlIGNvbGxlY3Rpb24gZm9yIGEgZ2l2ZW5cclxuICAgICAgICAgKiBvYmplY3QgYW5kIGEgZ2l2ZW4gdHlwZSBhY2NlcHQgbGlzdC5cclxuICAgICAgICAgKiBAZnVuY3Rpb24gc2V0SGFuZGxlclxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdERhdGF9IGRhdGFcclxuICAgICAgICAgKiBAcGFyYW0ge0hhbmRsZXJ9IGhhbmRsZXJcclxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ1tdfSBhY2NlcHRMaXN0XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgc2V0SGFuZGxlciA9IGZ1bmN0aW9uKG9iamVjdCwgZGF0YSwgaGFuZGxlciwgYWNjZXB0TGlzdCkge1xyXG4gICAgICAgICAgICB2YXIgaGRhdGEgPSBoYW5kbGVycy5nZXQoaGFuZGxlciksIG9kYXRhO1xyXG4gICAgICAgICAgICBpZiAoIWhkYXRhKVxyXG4gICAgICAgICAgICAgICAgaGFuZGxlcnMuc2V0KGhhbmRsZXIsIGhkYXRhID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIG9ic2VydmVkOiBjcmVhdGVNYXAoKSxcclxuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VSZWNvcmRzOiBbXVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGhkYXRhLm9ic2VydmVkLnNldChvYmplY3QsIHtcclxuICAgICAgICAgICAgICAgIGFjY2VwdExpc3Q6IGFjY2VwdExpc3Quc2xpY2UoKSxcclxuICAgICAgICAgICAgICAgIGRhdGE6IGRhdGFcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGRhdGEuaGFuZGxlcnMuc2V0KGhhbmRsZXIsIGhkYXRhKTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBBZGRzIGEgY2hhbmdlIHJlY29yZCBpbiBhIGdpdmVuIE9iamVjdERhdGFcclxuICAgICAgICAgKiBAZnVuY3Rpb24gYWRkQ2hhbmdlUmVjb3JkXHJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0RGF0YX0gZGF0YVxyXG4gICAgICAgICAqIEBwYXJhbSB7Q2hhbmdlUmVjb3JkfSBjaGFuZ2VSZWNvcmRcclxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gW2V4Y2VwdF1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhZGRDaGFuZ2VSZWNvcmQgPSBmdW5jdGlvbihvYmplY3QsIGRhdGEsIGNoYW5nZVJlY29yZCwgZXhjZXB0KSB7XHJcbiAgICAgICAgICAgIGRhdGEuaGFuZGxlcnMuZm9yRWFjaChmdW5jdGlvbihoZGF0YSkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGFjY2VwdExpc3QgPSBoZGF0YS5vYnNlcnZlZC5nZXQob2JqZWN0KS5hY2NlcHRMaXN0O1xyXG4gICAgICAgICAgICAgICAgLy8gSWYgZXhjZXB0IGlzIGRlZmluZWQsIE5vdGlmaWVyLnBlcmZvcm1DaGFuZ2UgaGFzIGJlZW5cclxuICAgICAgICAgICAgICAgIC8vIGNhbGxlZCwgd2l0aCBleGNlcHQgYXMgdGhlIHR5cGUuXHJcbiAgICAgICAgICAgICAgICAvLyBBbGwgdGhlIGhhbmRsZXJzIHRoYXQgYWNjZXB0cyB0aGF0IHR5cGUgYXJlIHNraXBwZWQuXHJcbiAgICAgICAgICAgICAgICBpZiAoKHR5cGVvZiBleGNlcHQgIT09IFwic3RyaW5nXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgfHwgaW5BcnJheShhY2NlcHRMaXN0LCBleGNlcHQpID09PSAtMSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgJiYgaW5BcnJheShhY2NlcHRMaXN0LCBjaGFuZ2VSZWNvcmQudHlwZSkgPiAtMSlcclxuICAgICAgICAgICAgICAgICAgICBoZGF0YS5jaGFuZ2VSZWNvcmRzLnB1c2goY2hhbmdlUmVjb3JkKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICBvYnNlcnZlZCA9IGNyZWF0ZU1hcCgpO1xyXG4gICAgaGFuZGxlcnMgPSBjcmVhdGVNYXAoKTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEBmdW5jdGlvbiBPYmplY3Qub2JzZXJ2ZVxyXG4gICAgICogQHNlZSBodHRwOi8vYXJ2LmdpdGh1Yi5pby9lY21hc2NyaXB0LW9iamVjdC1vYnNlcnZlLyNPYmplY3Qub2JzZXJ2ZVxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxyXG4gICAgICogQHBhcmFtIHtIYW5kbGVyfSBoYW5kbGVyXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ1tdfSBbYWNjZXB0TGlzdF1cclxuICAgICAqIEB0aHJvd3Mge1R5cGVFcnJvcn1cclxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9ICAgICAgICAgICAgICAgVGhlIG9ic2VydmVkIG9iamVjdFxyXG4gICAgICovXHJcbiAgICBPLm9ic2VydmUgPSBmdW5jdGlvbiBvYnNlcnZlKG9iamVjdCwgaGFuZGxlciwgYWNjZXB0TGlzdCkge1xyXG4gICAgICAgIGlmICghb2JqZWN0IHx8IHR5cGVvZiBvYmplY3QgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIG9iamVjdCAhPT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0Lm9ic2VydmUgY2Fubm90IG9ic2VydmUgbm9uLW9iamVjdFwiKTtcclxuXHJcbiAgICAgICAgaWYgKHR5cGVvZiBoYW5kbGVyICE9PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3Qub2JzZXJ2ZSBjYW5ub3QgZGVsaXZlciB0byBub24tZnVuY3Rpb25cIik7XHJcblxyXG4gICAgICAgIGlmIChPLmlzRnJvemVuICYmIE8uaXNGcm96ZW4oaGFuZGxlcikpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3Qub2JzZXJ2ZSBjYW5ub3QgZGVsaXZlciB0byBhIGZyb3plbiBmdW5jdGlvbiBvYmplY3RcIik7XHJcblxyXG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMikge1xyXG4gICAgICAgICAgICBpZiAoIWFjY2VwdExpc3QgfHwgdHlwZW9mIGFjY2VwdExpc3QgIT09IFwib2JqZWN0XCIpXHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0Lm9ic2VydmUgY2Fubm90IHVzZSBub24tb2JqZWN0IGFjY2VwdCBsaXN0XCIpO1xyXG4gICAgICAgIH0gZWxzZSBhY2NlcHRMaXN0ID0gZGVmYXVsdEFjY2VwdExpc3Q7XHJcblxyXG4gICAgICAgIGRvT2JzZXJ2ZShvYmplY3QsIGhhbmRsZXIsIGFjY2VwdExpc3QpO1xyXG5cclxuICAgICAgICByZXR1cm4gb2JqZWN0O1xyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEBmdW5jdGlvbiBPYmplY3QudW5vYnNlcnZlXHJcbiAgICAgKiBAc2VlIGh0dHA6Ly9hcnYuZ2l0aHViLmlvL2VjbWFzY3JpcHQtb2JqZWN0LW9ic2VydmUvI09iamVjdC51bm9ic2VydmVcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAqIEBwYXJhbSB7SGFuZGxlcn0gaGFuZGxlclxyXG4gICAgICogQHRocm93cyB7VHlwZUVycm9yfVxyXG4gICAgICogQHJldHVybnMge09iamVjdH0gICAgICAgICBUaGUgZ2l2ZW4gb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIE8udW5vYnNlcnZlID0gZnVuY3Rpb24gdW5vYnNlcnZlKG9iamVjdCwgaGFuZGxlcikge1xyXG4gICAgICAgIGlmIChvYmplY3QgPT09IG51bGwgfHwgdHlwZW9mIG9iamVjdCAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2Ygb2JqZWN0ICE9PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3QudW5vYnNlcnZlIGNhbm5vdCB1bm9ic2VydmUgbm9uLW9iamVjdFwiKTtcclxuXHJcbiAgICAgICAgaWYgKHR5cGVvZiBoYW5kbGVyICE9PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3QudW5vYnNlcnZlIGNhbm5vdCBkZWxpdmVyIHRvIG5vbi1mdW5jdGlvblwiKTtcclxuXHJcbiAgICAgICAgdmFyIGhkYXRhID0gaGFuZGxlcnMuZ2V0KGhhbmRsZXIpLCBvZGF0YTtcclxuXHJcbiAgICAgICAgaWYgKGhkYXRhICYmIChvZGF0YSA9IGhkYXRhLm9ic2VydmVkLmdldChvYmplY3QpKSkge1xyXG4gICAgICAgICAgICBoZGF0YS5vYnNlcnZlZC5mb3JFYWNoKGZ1bmN0aW9uKG9kYXRhLCBvYmplY3QpIHtcclxuICAgICAgICAgICAgICAgIHBlcmZvcm1Qcm9wZXJ0eUNoZWNrcyhvZGF0YS5kYXRhLCBvYmplY3QpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgbmV4dEZyYW1lKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgZGVsaXZlckhhbmRsZXJSZWNvcmRzKGhkYXRhLCBoYW5kbGVyKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAvLyBJbiBGaXJlZm94IDEzLTE4LCBzaXplIGlzIGEgZnVuY3Rpb24sIGJ1dCBjcmVhdGVNYXAgc2hvdWxkIGZhbGxcclxuICAgICAgICAgICAgLy8gYmFjayB0byB0aGUgc2hpbSBmb3IgdGhvc2UgdmVyc2lvbnNcclxuICAgICAgICAgICAgaWYgKGhkYXRhLm9ic2VydmVkLnNpemUgPT09IDEgJiYgaGRhdGEub2JzZXJ2ZWQuaGFzKG9iamVjdCkpXHJcbiAgICAgICAgICAgICAgICBoYW5kbGVyc1tcImRlbGV0ZVwiXShoYW5kbGVyKTtcclxuICAgICAgICAgICAgZWxzZSBoZGF0YS5vYnNlcnZlZFtcImRlbGV0ZVwiXShvYmplY3QpO1xyXG5cclxuICAgICAgICAgICAgaWYgKG9kYXRhLmRhdGEuaGFuZGxlcnMuc2l6ZSA9PT0gMSlcclxuICAgICAgICAgICAgICAgIG9ic2VydmVkW1wiZGVsZXRlXCJdKG9iamVjdCk7XHJcbiAgICAgICAgICAgIGVsc2Ugb2RhdGEuZGF0YS5oYW5kbGVyc1tcImRlbGV0ZVwiXShoYW5kbGVyKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBvYmplY3Q7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQGZ1bmN0aW9uIE9iamVjdC5nZXROb3RpZmllclxyXG4gICAgICogQHNlZSBodHRwOi8vYXJ2LmdpdGh1Yi5pby9lY21hc2NyaXB0LW9iamVjdC1vYnNlcnZlLyNHZXROb3RpZmllclxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxyXG4gICAgICogQHRocm93cyB7VHlwZUVycm9yfVxyXG4gICAgICogQHJldHVybnMge05vdGlmaWVyfVxyXG4gICAgICovXHJcbiAgICBPLmdldE5vdGlmaWVyID0gZnVuY3Rpb24gZ2V0Tm90aWZpZXIob2JqZWN0KSB7XHJcbiAgICAgICAgaWYgKG9iamVjdCA9PT0gbnVsbCB8fCB0eXBlb2Ygb2JqZWN0ICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiBvYmplY3QgIT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdC5nZXROb3RpZmllciBjYW5ub3QgZ2V0Tm90aWZpZXIgbm9uLW9iamVjdFwiKTtcclxuXHJcbiAgICAgICAgaWYgKE8uaXNGcm96ZW4gJiYgTy5pc0Zyb3plbihvYmplY3QpKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgICAgICAgcmV0dXJuIHJldHJpZXZlTm90aWZpZXIob2JqZWN0KTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAZnVuY3Rpb24gT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzXHJcbiAgICAgKiBAc2VlIGh0dHA6Ly9hcnYuZ2l0aHViLmlvL2VjbWFzY3JpcHQtb2JqZWN0LW9ic2VydmUvI09iamVjdC5kZWxpdmVyQ2hhbmdlUmVjb3Jkc1xyXG4gICAgICogQHNlZSBodHRwOi8vYXJ2LmdpdGh1Yi5pby9lY21hc2NyaXB0LW9iamVjdC1vYnNlcnZlLyNEZWxpdmVyQ2hhbmdlUmVjb3Jkc1xyXG4gICAgICogQHBhcmFtIHtIYW5kbGVyfSBoYW5kbGVyXHJcbiAgICAgKiBAdGhyb3dzIHtUeXBlRXJyb3J9XHJcbiAgICAgKi9cclxuICAgIE8uZGVsaXZlckNoYW5nZVJlY29yZHMgPSBmdW5jdGlvbiBkZWxpdmVyQ2hhbmdlUmVjb3JkcyhoYW5kbGVyKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBoYW5kbGVyICE9PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3QuZGVsaXZlckNoYW5nZVJlY29yZHMgY2Fubm90IGRlbGl2ZXIgdG8gbm9uLWZ1bmN0aW9uXCIpO1xyXG5cclxuICAgICAgICB2YXIgaGRhdGEgPSBoYW5kbGVycy5nZXQoaGFuZGxlcik7XHJcbiAgICAgICAgaWYgKGhkYXRhKSB7XHJcbiAgICAgICAgICAgIGhkYXRhLm9ic2VydmVkLmZvckVhY2goZnVuY3Rpb24ob2RhdGEsIG9iamVjdCkge1xyXG4gICAgICAgICAgICAgICAgcGVyZm9ybVByb3BlcnR5Q2hlY2tzKG9kYXRhLmRhdGEsIG9iamVjdCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBkZWxpdmVySGFuZGxlclJlY29yZHMoaGRhdGEsIGhhbmRsZXIpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG59KShPYmplY3QsIEFycmF5LCB0aGlzKTsiLCJ2YXIgdGVtcGxhdGluZyA9IHJlcXVpcmUoXCJkcm9vcHktdGVtcGxhdGluZ1wiKTtcclxuXHJcbnZhciBBcnJheUJpbmRpbmcgPSBmdW5jdGlvbihlbGVtZW50LCBmdWxsUHJvcGVydHkpIHtcclxuXHR0aGlzLmVsZW1lbnQgPSBlbGVtZW50O1xyXG5cdHRoaXMub3JpZ2luYWwgPSBlbGVtZW50LmlubmVySFRNTDtcclxuXHR0aGlzLmZ1bGxQcm9wZXJ0eSA9IGZ1bGxQcm9wZXJ0eTtcclxufTtcclxuXHJcbkFycmF5QmluZGluZy5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oc2NvcGUpIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblx0dmFyIGFycmF5SHRtbCA9IFwiXCI7XHJcblx0dmFyIGFycmF5ID0gdGVtcGxhdGluZy5nZXRPYmplY3RWYWx1ZShzY29wZSwgc2VsZi5mdWxsUHJvcGVydHkpO1xyXG5cdGlmIChhcnJheSAmJiBBcnJheS5pc0FycmF5KGFycmF5KSkge1xyXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRhcnJheUh0bWwgKz0gdGVtcGxhdGluZy5wb3B1bGF0ZVRlbXBsYXRlKHNlbGYub3JpZ2luYWwsIGFycmF5W2ldLCB0ZW1wbGF0aW5nLkVhY2gucmVnRXhwKTtcclxuXHRcdH1cclxuXHR9XHJcblx0c2VsZi5lbGVtZW50LmlubmVySFRNTCA9IGFycmF5SHRtbDtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQXJyYXlCaW5kaW5nOyIsInZhciB0ZW1wbGF0aW5nID0gcmVxdWlyZShcImRyb29weS10ZW1wbGF0aW5nXCIpO1xyXG52YXIgTm9kZUJpbmRpbmcgPSByZXF1aXJlKFwiLi9ub2RlQmluZGluZ1wiKTtcclxudmFyIEFycmF5QmluZGluZyA9IHJlcXVpcmUoXCIuL2FycmF5QmluZGluZ1wiKTtcclxudmFyIEV2ZW50YWJsZSA9IHJlcXVpcmUoXCJkcm9vcHktZXZlbnRzXCIpO1xyXG5cclxudmFyIERyb29weUJpbmRpbmcgPSBmdW5jdGlvbihjb250YWluZXJJZCwgbW9kZWwsIG9wdGlvbnMpIHtcclxuXHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcclxuXHR0aGlzLm1vZGVsID0gbW9kZWw7XHJcblx0dGhpcy5jb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChjb250YWluZXJJZCk7XHJcblx0dGhpcy5vYnNlcnZlQXJyYXlJdGVtcyA9IG9wdGlvbnMub2JzZXJ2ZUFycmF5SXRlbXMgfHwgZmFsc2U7XHJcblx0Ly9HZXQgYWxsIGJpbmRpbmdzXHJcblx0dGhpcy5iaW5kaW5ncyA9IHRoaXMuZ2V0QmluZGluZ3ModGhpcy5jb250YWluZXIpO1xyXG5cdEV2ZW50YWJsZS5jYWxsKHRoaXMpO1xyXG5cclxuXHRpZiAob3B0aW9ucy5zaG91bGRJbml0ICE9PSBmYWxzZSkge1xyXG5cdFx0dGhpcy5pbml0KCk7XHJcblx0fVxyXG59O1xyXG5cclxuRHJvb3B5QmluZGluZy5wcm90b3R5cGUgPSBuZXcgRXZlbnRhYmxlKCk7XHJcbkRyb29weUJpbmRpbmcucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbigpIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblx0c2VsZi51cGRhdGVCaW5kaW5ncygpO1xyXG5cdHNlbGYucmVjdXJzaXZlT2JzZXJ2ZShzZWxmLm1vZGVsLCBcIlwiLCBmdW5jdGlvbihjaGFuZ2VzLCBwcm9wQ2hhaW4pIHtcclxuXHRcdHNlbGYuaGFuZGxlT2JqZWN0Q2hhbmdlKGNoYW5nZXMsIHByb3BDaGFpbik7XHJcblx0fSk7XHJcbn07XHJcbkRyb29weUJpbmRpbmcucHJvdG90eXBlLnJlY3Vyc2l2ZU9ic2VydmUgPSBmdW5jdGlvbihvYmosIHByb3BDaGFpbiwgY2FsbGJhY2spIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblx0Ly8gTWFrZSBzdXJlIGl0cyBhbiBhcnJheSBvciBvYmplY3RcclxuXHRpZiAoIUFycmF5LmlzQXJyYXkob2JqKSAmJiB0eXBlb2Ygb2JqICE9PSBcIm9iamVjdFwiKSByZXR1cm47XHJcblxyXG5cdGlmIChBcnJheS5pc0FycmF5KG9iaikpIHtcclxuXHRcdGlmIChmYWxzZSAmJiBBcnJheS5vYnNlcnZlKSB7XHJcblx0XHRcdEFycmF5Lm9ic2VydmUob2JqLCBmdW5jdGlvbihjaGFuZ2VzKSB7XHJcblx0XHRcdFx0c2VsZi5oYW5kbGVBcnJheUNoYW5nZShjaGFuZ2VzLCBwcm9wQ2hhaW4pO1xyXG5cdFx0XHR9KTtcdFx0XHRcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdE9iamVjdC5vYnNlcnZlKG9iaiwgZnVuY3Rpb24oY2hhbmdlcykge1xyXG5cdFx0XHRcdHNlbGYuaGFuZGxlQXJyYXlDaGFuZ2UoY2hhbmdlcywgcHJvcENoYWluKTtcclxuXHRcdFx0fSk7XHRcclxuXHRcdH1cclxuXHRcdGlmICh0aGlzLm9ic2VydmVBcnJheUl0ZW1zKSB7XHJcblx0XHRcdC8vIFJlY3Vyc2l2ZWx5IG9ic2VydmUgYW55IGFycmF5IGl0ZW1zXHJcblx0XHRcdG9iai5mb3JFYWNoKGZ1bmN0aW9uKGFycmF5SXRlbSwgaSl7XHJcblx0XHRcdFx0c2VsZi5yZWN1cnNpdmVPYnNlcnZlKGFycmF5SXRlbSwgXCJcIiwgZnVuY3Rpb24oY2hhbmdlcykgeyBcclxuXHRcdFx0XHRcdHNlbGYuaGFuZGxlQXJyYXlDaGFuZ2UuY2FsbChzZWxmLCBjaGFuZ2VzLCBwcm9wQ2hhaW4pO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcdFx0XHRcclxuXHRcdH1cclxuXHR9IGVsc2Uge1xyXG5cdFx0T2JqZWN0Lm9ic2VydmUob2JqLCBmdW5jdGlvbihjaGFuZ2VzKSB7XHJcblx0XHRcdGNhbGxiYWNrKGNoYW5nZXMsIHByb3BDaGFpbik7XHJcblx0XHR9KTtcclxuXHRcdFxyXG5cdFx0Ly8gUmVjdXJzaXZlbHkgb2JzZXJ2ZSBhbnkgY2hpbGQgb2JqZWN0c1xyXG5cdFx0T2JqZWN0LmtleXMob2JqKS5mb3JFYWNoKGZ1bmN0aW9uKHByb3BOYW1lKSB7XHJcblx0XHRcdHZhciBuZXdQcm9wQ2hhaW4gPSBwcm9wQ2hhaW47XHJcblx0XHRcdGlmIChuZXdQcm9wQ2hhaW4pIHtcclxuXHRcdFx0XHRuZXdQcm9wQ2hhaW4gKz0gXCIuXCIgKyBwcm9wTmFtZTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRuZXdQcm9wQ2hhaW4gPSBwcm9wTmFtZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRzZWxmLnJlY3Vyc2l2ZU9ic2VydmUob2JqW3Byb3BOYW1lXSwgbmV3UHJvcENoYWluLCBjYWxsYmFjayk7XHJcblx0XHR9KTtcclxuXHR9XHJcblx0XHJcbn07XHJcblxyXG5Ecm9vcHlCaW5kaW5nLnByb3RvdHlwZS5oYW5kbGVBcnJheUNoYW5nZSA9IGZ1bmN0aW9uKGNoYW5nZXMsIHByb3BDaGFpbikge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHR2YXIgY291bnQgPSAwO1xyXG5cdC8vIFJlLW9ic2VydmUgYW55IG5ldyBvYmplY3RzXHJcblx0Y2hhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uKGNoYW5nZSl7XHJcblx0XHRjb3VudCsrO1xyXG5cdFx0Ly9JZiBpdHMgYW4gYXJyYXkgY2hhbmdlLCBhbmQgYW4gdXBkYXRlLCBpdHMgYSBuZXcgaW5kZXggYXNzaWdubWVudCBzbyByZS1vYnNlcnZlXHJcblx0XHRpZiAoQXJyYXkuaXNBcnJheShjaGFuZ2Uub2JqZWN0KSAmJiBjaGFuZ2UudHlwZSA9PT0gXCJ1cGRhdGVcIikge1xyXG5cdFx0XHRzZWxmLnJlY3Vyc2l2ZU9ic2VydmUoY2hhbmdlLm9iamVjdFtjaGFuZ2UubmFtZV0sIFwiXCIsIGZ1bmN0aW9uKGNoYW5nZXMpIHsgXHJcblx0XHRcdFx0c2VsZi5oYW5kbGVBcnJheUNoYW5nZS5jYWxsKHNlbGYsIGNoYW5nZXMsIHByb3BDaGFpbik7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSBcclxuXHRcdC8vIElmIGl0cyBhIHB1c2ggb3IgYSBwb3AgaXQgd2lsbCBjb21lIHRocm91Z2ggYXMgc3BsaWNlXHJcblx0XHRlbHNlIGlmIChBcnJheS5pc0FycmF5KGNoYW5nZS5vYmplY3QpICYmIGNoYW5nZS50eXBlID09PSBcInNwbGljZVwiKSB7XHJcblx0XHRcdC8vIElmIGl0cyBhIHB1c2gsIGFkZGVkQ291bnQgd2lsbCBiZSAxXHJcblx0XHRcdGlmIChjaGFuZ2UuYWRkZWRDb3VudCA+IDApIHtcclxuXHRcdFx0XHQvLyBzdGFydCBvYnNlcnZpbmcgdGhlIG5ldyBhcnJheSBpdGVtXHJcblx0XHRcdFx0c2VsZi5yZWN1cnNpdmVPYnNlcnZlKGNoYW5nZS5vYmplY3RbY2hhbmdlLmluZGV4XSwgXCJcIiwgZnVuY3Rpb24oY2hhbmdlcykgeyBcclxuXHRcdFx0XHRcdHNlbGYuaGFuZGxlQXJyYXlDaGFuZ2UuY2FsbChzZWxmLCBjaGFuZ2VzLCBwcm9wQ2hhaW4pO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vIElmIGl0cyBhIHBvcCB3ZSByZWFsbHkgZG9uJ3QgY2FyZSBoZXJlIGJlY2F1c2UgdGhlcmUgaXMgbm90aGluZyB0byByZS1vYnNlcnZlXHJcblx0XHR9XHJcblx0fSk7XHJcblx0Ly8gUmVyZW5kZXIgZGF0YS1lYWNoIGJpbmRpbmdzIHRoYXQgYXJlIHRpZWQgdG8gdGhlIGFycmF5XHJcblx0c2VsZi5iaW5kaW5ncy5mb3JFYWNoKGZ1bmN0aW9uKGJpbmRpbmcpIHtcclxuXHRcdGlmIChiaW5kaW5nLmZ1bGxQcm9wZXJ0eSA9PT0gcHJvcENoYWluKSB7XHJcblx0XHRcdGJpbmRpbmcudXBkYXRlKHNlbGYubW9kZWwpO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG59O1xyXG5cclxudmFyIF9maW5kQmluZGluZ3MgPSBmdW5jdGlvbihiaW5kaW5ncywgcHJvcGVydHkpIHtcclxuXHRyZXR1cm4gYmluZGluZ3MuZmlsdGVyKGZ1bmN0aW9uKGJpbmRpbmcpIHtcclxuXHRcdHJldHVybiAoYmluZGluZy5mdWxsUHJvcGVydHkuaW5kZXhPZihwcm9wZXJ0eSkgPT09IDApXHJcblx0fSk7XHJcbn07XHJcblxyXG5Ecm9vcHlCaW5kaW5nLnByb3RvdHlwZS5oYW5kbGVPYmplY3RDaGFuZ2UgPSBmdW5jdGlvbihjaGFuZ2VzLCBwcm9wQ2hhaW4pIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblx0Y2hhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uKGNoYW5nZSkge1xyXG5cdFx0Ly8gR2V0IHRoZSBwcm9wZXJ0eSBjaGFpbiBzdHJpbmcgdG8gdGllIGJhY2sgdG8gVUkgcGxhY2Vob2xkZXJcclxuXHRcdHZhciBjaGFuZ2VkUHJvcCA9IGNoYW5nZS5uYW1lO1xyXG5cdFx0aWYgKHByb3BDaGFpbikge1xyXG5cdFx0XHRjaGFuZ2VkUHJvcCA9IHByb3BDaGFpbiArIFwiLlwiICsgY2hhbmdlLm5hbWU7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gQ2hlY2sgZWFjaCBiaW5kaW5nIHRvIHNlZSBpZiBpdCBjYXJlcywgdXBkYXRlIGlmIGl0IGRvZXNcclxuXHRcdF9maW5kQmluZGluZ3Moc2VsZi5iaW5kaW5ncywgY2hhbmdlZFByb3ApLmZvckVhY2goZnVuY3Rpb24oYmluZGluZyl7XHJcblx0XHRcdGJpbmRpbmcudXBkYXRlKHNlbGYubW9kZWwpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0Ly8gSWYgb2JqZWN0IGdldHMgb3ZlcndyaXR0ZW4sIG5lZWQgdG8gcmUtb2JzZXJ2ZSBpdFxyXG5cdFx0aWYgKGNoYW5nZS50eXBlID09PSBcInVwZGF0ZVwiKSB7XHJcblx0XHRcdHNlbGYucmVjdXJzaXZlT2JzZXJ2ZShjaGFuZ2Uub2JqZWN0W2NoYW5nZS5uYW1lXSwgY2hhbmdlZFByb3AsIGZ1bmN0aW9uKGNoYW5nZXMsIHByb3BDaGFpbikge1xyXG5cdFx0XHRcdHNlbGYuaGFuZGxlT2JqZWN0Q2hhbmdlKGNoYW5nZXMsIHByb3BDaGFpbik7XHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG59O1xyXG5cclxuRHJvb3B5QmluZGluZy5wcm90b3R5cGUudXBkYXRlQmluZGluZ3MgPSBmdW5jdGlvbigpIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblx0c2VsZi5iaW5kaW5ncy5mb3JFYWNoKGZ1bmN0aW9uKGJpbmRpbmcpIHtcclxuXHRcdGJpbmRpbmcudXBkYXRlKHNlbGYubW9kZWwpO1xyXG5cdH0pO1xyXG59O1xyXG5cclxuRHJvb3B5QmluZGluZy5wcm90b3R5cGUudXBkYXRlTW9kZWxQcm9wZXJ0eSA9IGZ1bmN0aW9uKGZ1bGxQcm9wZXJ0eSwgbmV3VmFsdWUpIHtcclxuXHQvL3N0YXJ0IHdpdGggdGhlIG1vZGVsXHJcblx0dmFyIHByb3BlcnR5Q2hhaW4gPSBmdWxsUHJvcGVydHkuc3BsaXQoJy4nKTtcclxuXHR2YXIgcGFyZW50T2JqID0gdGhpcy5tb2RlbDtcclxuXHR2YXIgcHJvcGVydHkgPSBmdWxsUHJvcGVydHk7XHJcblx0Ly90cmF2ZXJzZSB0aGUgcHJvcGVydHkgY2hhaW4sIGV4Y2VwdCBmb3IgbGFzdCBvbmVcclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IHByb3BlcnR5Q2hhaW4ubGVuZ3RoIC0gMTsgaSsrKSB7XHJcblx0XHRpZiAocGFyZW50T2JqW3Byb3BlcnR5Q2hhaW5baV1dICE9IG51bGwpIHtcclxuXHRcdFx0cHJvcGVydHkgPSBwcm9wZXJ0eUNoYWluW2ldO1xyXG5cdFx0XHRwYXJlbnRPYmogPSBwYXJlbnRPYmpbcHJvcGVydHldO1xyXG5cdFx0fSBcclxuXHR9XHJcblx0Ly9pZiBpdHMgYW4gdW5kZXJzY29yZSwgaXRzIHJlZmVyZW5jaW5nIHRoZSBtb2RlbCBzY29wZVxyXG5cdGlmKGZ1bGxQcm9wZXJ0eSA9PT0gXCJfXCIpIHtcclxuXHRcdHBhcmVudE9iaiA9IG5ld1ZhbHVlO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRwcm9wZXJ0eSA9IHByb3BlcnR5Q2hhaW5bcHJvcGVydHlDaGFpbi5sZW5ndGggLSAxXTtcclxuXHRcdHBhcmVudE9ialtwcm9wZXJ0eV0gPSBuZXdWYWx1ZTtcclxuXHR9XHJcbn07XHJcblxyXG5Ecm9vcHlCaW5kaW5nLnByb3RvdHlwZS51cGRhdGVNb2RlbCA9IGZ1bmN0aW9uKG5ld01vZGVsKSB7XHJcblx0dGhpcy5tb2RlbCA9IG5ld01vZGVsO1xyXG5cdHRoaXMuaW5pdCgpO1xyXG59O1xyXG5cclxuRHJvb3B5QmluZGluZy5wcm90b3R5cGUuYmluZEV2ZW50cyA9IGZ1bmN0aW9uKG5vZGVCaW5kaW5nKSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cdG5vZGVCaW5kaW5nLm9uKFwiaW5wdXQtY2hhbmdlXCIsIHNlbGYudXBkYXRlTW9kZWxQcm9wZXJ0eS5iaW5kKHNlbGYpKTtcclxuXHRub2RlQmluZGluZy5vbihcInVwZGF0aW5nXCIsIGZ1bmN0aW9uKGZ1bGxQcm9wZXJ0eSkge1xyXG5cdFx0c2VsZi5icm9hZGNhc3QoXCJ1cGRhdGluZ1wiLCBmdWxsUHJvcGVydHkpO1xyXG5cdH0pO1xyXG5cdG5vZGVCaW5kaW5nLm9uKFwidXBkYXRlZFwiLCBmdW5jdGlvbihmdWxsUHJvcGVydHkpIHtcclxuXHRcdHNlbGYuYnJvYWRjYXN0KFwidXBkYXRlZFwiLCBmdWxsUHJvcGVydHkpO1xyXG5cdH0pO1xyXG59O1xyXG5cclxuRHJvb3B5QmluZGluZy5wcm90b3R5cGUuYnJvYWRjYXN0ID0gZnVuY3Rpb24oZXZlbnQsIGZ1bGxQcm9wZXJ0eSkge1xyXG5cdHZhciBwcm9wZXJ0aWVzID0gZnVsbFByb3BlcnR5LnNwbGl0KFwiLlwiKTtcclxuXHR2YXIgcHJvcENoYWluID0gXCJcIjtcclxuXHRmb3IodmFyIGkgPSAwOyBpIDwgcHJvcGVydGllcy5sZW5ndGg7IGkrKykge1xyXG5cdFx0cHJvcENoYWluID0gcHJvcENoYWluICsgcHJvcGVydGllc1tpXTtcclxuXHRcdHRoaXMudHJpZ2dlcihldmVudCArIFwiLVwiICsgcHJvcENoYWluKTtcclxuXHRcdHByb3BDaGFpbiArPSBcIi5cIjtcclxuXHR9XHJcbn07XHJcbkRyb29weUJpbmRpbmcucHJvdG90eXBlLmdldEJpbmRpbmdzID0gZnVuY3Rpb24oZWxlbWVudCkge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHR2YXIgYmluZGluZ3MgPSBbXTtcclxuXHR2YXIgcGxhY2Vob2xkZXJzID0gW107XHJcblx0dmFyIGkgPSAwO1xyXG5cdC8vIDEuIExvb2sgZm9yIGF0dHJpYnV0ZSBiaW5kaW5ncyBhbmQgYXJyYXkgYmluZGluZ3Mgb24gdGhlIGN1cnJlbnQgZWxlbWVudFxyXG5cdGlmIChlbGVtZW50LmF0dHJpYnV0ZXMpIHtcclxuXHRcdGZvciAoaSA9IDA7IGkgPCBlbGVtZW50LmF0dHJpYnV0ZXMubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0aWYgKGVsZW1lbnQuYXR0cmlidXRlc1tpXS5ub2RlTmFtZSA9PT0gXCJkYXRhLWVhY2hcIikge1xyXG5cdFx0XHRcdGJpbmRpbmdzLnB1c2gobmV3IEFycmF5QmluZGluZyhlbGVtZW50LCBlbGVtZW50LmF0dHJpYnV0ZXNbaV0ubm9kZVZhbHVlKSk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dmFyIGF0dHJpYnV0ZUJpbmRpbmdzID0gdGVtcGxhdGluZy5nZXRQbGFjZUhvbGRlcnMoZWxlbWVudC5hdHRyaWJ1dGVzW2ldLm5vZGVWYWx1ZSlcclxuXHRcdFx0XHRcdC5tYXAoZnVuY3Rpb24ocGxhY2Vob2xkZXIpIHtcclxuXHRcdFx0XHRcdFx0dmFyIGJpbmRpbmcgPSBuZXcgTm9kZUJpbmRpbmcoZWxlbWVudC5hdHRyaWJ1dGVzW2ldLCBwbGFjZWhvbGRlciwgZWxlbWVudCk7XHJcblx0XHRcdFx0XHRcdHNlbGYuYmluZEV2ZW50cyhiaW5kaW5nKTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIGJpbmRpbmc7XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHRiaW5kaW5ncyA9IGJpbmRpbmdzLmNvbmNhdChhdHRyaWJ1dGVCaW5kaW5ncyk7XHRcdFx0XHRcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHQvLyAyLmEgSWYgdGhlIGVsZW1lbnQgaGFzIGNoaWxkcmVuLCBpdCB3b24ndCBoYXZlIGEgdGV4dCBiaW5kaW5nLiBSZWN1cnNlIG9uIGNoaWxkcmVuXHJcblx0aWYgKGVsZW1lbnQuY2hpbGROb2RlcyAmJiBlbGVtZW50LmNoaWxkTm9kZXMubGVuZ3RoKSB7XHJcblx0XHQvL3JlY3Vyc2l2ZSBjYWxsIGZvciBlYWNoIGNoaWxkbm9kZVxyXG5cdFx0Zm9yIChpID0gMDsgaSA8IGVsZW1lbnQuY2hpbGROb2Rlcy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRiaW5kaW5ncyA9IGJpbmRpbmdzLmNvbmNhdChzZWxmLmdldEJpbmRpbmdzKGVsZW1lbnQuY2hpbGROb2Rlc1tpXSkpO1xyXG5cdFx0fVxyXG5cdH0gZWxzZSB7XHJcblx0XHQvLyAyLmIgVGhlIGVsZW1lbnQgZG9lc24ndCBoYXZlIGNoaWxkcmVuIHNvIGxvb2sgZm9yIGEgdGV4dCBiaW5kaW5nXHJcblx0XHRwbGFjZWhvbGRlcnMgPSB0ZW1wbGF0aW5nLmdldFBsYWNlSG9sZGVycyhlbGVtZW50LnRleHRDb250ZW50KTtcclxuXHRcdHZhciB0ZXh0QmluZGluZ3MgPSBwbGFjZWhvbGRlcnMubWFwKGZ1bmN0aW9uKHBsYWNlaG9sZGVyKSB7XHJcblx0XHRcdHZhciBiaW5kaW5nID0gbmV3IE5vZGVCaW5kaW5nKGVsZW1lbnQsIHBsYWNlaG9sZGVyLCBlbGVtZW50LnBhcmVudE5vZGUpO1xyXG5cdFx0XHRzZWxmLmJpbmRFdmVudHMoYmluZGluZyk7XHJcblx0XHRcdHJldHVybiBiaW5kaW5nO1xyXG5cdFx0fSk7XHJcblx0XHRiaW5kaW5ncyA9IGJpbmRpbmdzLmNvbmNhdCh0ZXh0QmluZGluZ3MpO1xyXG5cdH1cclxuXHRyZXR1cm4gYmluZGluZ3M7XHJcbn07XHJcblxyXG5Ecm9vcHlCaW5kaW5nLnByb3RvdHlwZS5zdWJzY3JpYmUgPSBmdW5jdGlvbihldmVudCwgcHJvcGVydHksIGNhbGxiYWNrKSB7XHJcblx0dGhpcy5vbihldmVudCArIFwiLVwiICsgcHJvcGVydHksIGNhbGxiYWNrKTtcclxufTtcclxuXHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBEcm9vcHlCaW5kaW5nOyIsInZhciB0ZW1wbGF0aW5nID0gcmVxdWlyZShcImRyb29weS10ZW1wbGF0aW5nXCIpO1xyXG52YXIgRXZlbnRhYmxlID0gcmVxdWlyZShcImRyb29weS1ldmVudHNcIik7XHJcblxyXG52YXIgTm9kZUJpbmRpbmcgPSBmdW5jdGlvbihub2RlLCBwbGFjZWhvbGRlciwgZWxlbWVudCkge1xyXG5cdEV2ZW50YWJsZS5jYWxsKHRoaXMpO1xyXG5cdHRoaXMubm9kZSA9IG5vZGU7XHJcblx0dGhpcy5vcmlnaW5hbCA9IG5vZGUubm9kZVZhbHVlO1xyXG5cdHRoaXMucmF3ID0gcGxhY2Vob2xkZXI7XHJcblx0dGhpcy5mdWxsUHJvcGVydHkgPSB0aGlzLnJhdy5zbGljZSgyLCB0aGlzLnJhdy5sZW5ndGggLSAyKTtcclxuXHQvL2lmIG5vIGVsZW1lbnQgd2FzIHBhc3NlZCBpbiwgaXQgaXMgYSB0ZXh0IGJpbmRpbmcsIG90aGVyd2lzZSBhdHRyaWJ1dGVcclxuXHR0aGlzLmVsZW1lbnQgPSBlbGVtZW50IHx8IG5vZGU7IFxyXG5cdHRoaXMuc2V0dXBUd29XYXkoKTtcclxufTtcclxuXHJcbk5vZGVCaW5kaW5nLnByb3RvdHlwZSA9IG5ldyBFdmVudGFibGUoKTtcclxuXHJcbk5vZGVCaW5kaW5nLnByb3RvdHlwZS5zZXR1cFR3b1dheSA9IGZ1bmN0aW9uKCkge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHRpZiAodGhpcy5lbGVtZW50ICYmIHRoaXMuZWxlbWVudC50YWdOYW1lKSB7XHJcblx0XHR2YXIgZWxlbWVudFR5cGUgPSB0aGlzLmVsZW1lbnQudGFnTmFtZS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0Ly8gVEVYVCBBUkVBXHJcblx0XHRpZiAoZWxlbWVudFR5cGUgPT09IFwidGV4dGFyZWFcIikge1xyXG5cdFx0XHR0aGlzLmVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImlucHV0XCIsIHRoaXMub25JbnB1dENoYW5nZS5iaW5kKHRoaXMpKTtcclxuXHJcblx0XHR9IGVsc2UgaWYgKHRoaXMubm9kZS5ub2RlTmFtZSA9PT0gXCJ2YWx1ZVwiKSB7XHJcblx0XHRcdC8vIElOUFVUIGVsZW1lbnRcclxuXHRcdFx0aWYgKGVsZW1lbnRUeXBlID09PSBcImlucHV0XCIpIHtcclxuXHRcdFx0XHR0aGlzLmVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImlucHV0XCIsIHRoaXMub25JbnB1dENoYW5nZS5iaW5kKHRoaXMpKTtcclxuXHRcdFx0XHR0aGlzLmVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCB0aGlzLm9uSW5wdXRDaGFuZ2UuYmluZCh0aGlzKSk7XHJcblx0XHRcdH0gXHJcblx0XHRcdC8vIFNFTEVDVCBlbGVtZW50XHJcblx0XHRcdGVsc2UgaWYgKGVsZW1lbnRUeXBlID09PSBcInNlbGVjdFwiKSB7XHJcblx0XHRcdFx0dGhpcy5lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgdGhpcy5vbklucHV0Q2hhbmdlLmJpbmQodGhpcykpO1xyXG5cdFx0XHRcdHNldFRpbWVvdXQodGhpcy5vbklucHV0Q2hhbmdlLmJpbmQodGhpcyksIDEpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG59O1xyXG5cclxuTm9kZUJpbmRpbmcucHJvdG90eXBlLm9uSW5wdXRDaGFuZ2UgPSBmdW5jdGlvbigpIHtcclxuXHQvL2NhbGxlZCB3aXRoIGJpbmQsIHNvICd0aGlzJyBpcyBhY3R1YWxseSB0aGlzXHJcblx0dGhpcy50cmlnZ2VyKFwiaW5wdXQtY2hhbmdlXCIsIHRoaXMuZnVsbFByb3BlcnR5LCB0aGlzLmVsZW1lbnQudmFsdWUgKTtcclxufTtcclxuXHJcbk5vZGVCaW5kaW5nLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbihtb2RlbCkge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHRzZWxmLnRyaWdnZXIoXCJ1cGRhdGluZ1wiLCBzZWxmLmZ1bGxQcm9wZXJ0eSk7XHJcblx0Ly9za2lwIGEgdGljayBpbiBldmVudCBsb29wIHRvIGxldCAndXBkYXRpbmcnIGJlIGhhbmRsZWQgYmVmb3JlIHVwZGF0ZVxyXG5cdFx0dmFyIGh0bWwgPSB0ZW1wbGF0aW5nLnJlbmRlclRlbXBsYXRlKHNlbGYub3JpZ2luYWwsIG1vZGVsKTtcclxuXHRcdHNlbGYubm9kZS5ub2RlVmFsdWUgPSBodG1sO1xyXG5cdFx0aWYgKHNlbGYubm9kZS5ub2RlTmFtZSA9PT0gXCJ2YWx1ZVwiICYmIHNlbGYuZWxlbWVudCkge1xyXG5cdFx0XHRpZiAoc2VsZi5lbGVtZW50LnZhbHVlICE9PSBodG1sKSB7XHJcblx0XHRcdFx0c2VsZi5lbGVtZW50LnZhbHVlID0gaHRtbDtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0c2VsZi50cmlnZ2VyKFwidXBkYXRlZFwiLCBzZWxmLmZ1bGxQcm9wZXJ0eSk7XHRcdFxyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBOb2RlQmluZGluZzsiXX0=
