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

DroopyBinding.prototype.handleObjectChange = function(changes, propChain) {
	var self = this;
	changes.forEach(function(change) {
		// Get the property chain string to tie back to UI placeholder
		var changedProp = change.name;
		if (propChain) {
			changedProp = propChain + "." + change.name;
		}

		// Check each binding to see if it cares, update if it does
		self.bindings.forEach(function(binding) {
			// starts with prop chain to allow whole child object to be updated
			if (binding.fullProperty.indexOf(changedProp) === 0) {
				binding.update(self.model);
			}
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
			return new NodeBinding(element, placeholder);
		});
		bindings = bindings.concat(textBindings);
	}
	return bindings;
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
	if (this.node.nodeName === "value" && this.element) {
		if (this.element.tagName.toLowerCase() === "input") {
			this.element.addEventListener("input", this.onInputChange.bind(this));
		}
		if (this.element.tagName.toLowerCase() === "select") {
			this.element.addEventListener("change", this.onInputChange.bind(this));
		}
	}
};

NodeBinding.prototype.onInputChange = function() {
	//called with bind, so 'this' is actually this
	this.trigger("input-change", this.fullProperty, this.element.value );
};

NodeBinding.prototype.update = function(model) {
	var self = this;
	var html = templating.renderTemplate(self.original, model);
	self.node.nodeValue = html;
	if (self.node.nodeName === "value" && self.element) {
		self.element.value = html;
	}
};

module.exports = NodeBinding;
},{"droopy-events":2,"droopy-templating":3}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkM6XFxnaXR3aXBcXGRyb29weS1iaW5kaW5nXFxub2RlX21vZHVsZXNcXGd1bHAtYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXItcGFja1xcX3ByZWx1ZGUuanMiLCJDOi9naXR3aXAvZHJvb3B5LWJpbmRpbmcvZW50cmllcy9mYWtlXzVlMjdkNjcyLmpzIiwiQzovZ2l0d2lwL2Ryb29weS1iaW5kaW5nL25vZGVfbW9kdWxlcy9kcm9vcHktZXZlbnRzL0V2ZW50QWdncmVnYXRvci5qcyIsIkM6L2dpdHdpcC9kcm9vcHktYmluZGluZy9ub2RlX21vZHVsZXMvZHJvb3B5LXRlbXBsYXRpbmcvZHJvb3B5LXRlbXBsYXRpbmcuanMiLCJDOi9naXR3aXAvZHJvb3B5LWJpbmRpbmcvbm9kZV9tb2R1bGVzL29iamVjdC5vYnNlcnZlL2Rpc3Qvb2JqZWN0LW9ic2VydmUuanMiLCJDOi9naXR3aXAvZHJvb3B5LWJpbmRpbmcvc3JjL2FycmF5QmluZGluZy5qcyIsIkM6L2dpdHdpcC9kcm9vcHktYmluZGluZy9zcmMvZHJvb3B5QmluZGluZy5qcyIsIkM6L2dpdHdpcC9kcm9vcHktYmluZGluZy9zcmMvbm9kZUJpbmRpbmcuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbnVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbnZhciBwb2x5ZmlsbCA9IHJlcXVpcmUoXCJvYmplY3Qub2JzZXJ2ZVwiKTtcclxuZ2xvYmFsLmRyb29weUJpbmRpbmcgPSB7fTtcclxuZ2xvYmFsLkRyb29weUJpbmRpbmcgPSByZXF1aXJlKFwiLi4vc3JjL2Ryb29weUJpbmRpbmdcIik7XHJcbmV4cG9ydHMuRHJvb3B5QmluZGluZyA9IGdsb2JhbC5Ecm9vcHlCaW5kaW5nO1xufSkuY2FsbCh0aGlzLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCJ2YXIgRXZlbnRBZ2dyZWdhdG9yID0gZnVuY3Rpb24oKSB7XHJcblx0dGhpcy5ldmVudEtleXMgPSB7fTtcclxuXHR0aGlzLmxhc3RTdWJzY3JpcHRpb25JZCA9IC0xO1xyXG59O1xyXG5cclxuRXZlbnRBZ2dyZWdhdG9yLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKGtleSwgY2FsbGJhY2spIHtcclxuXHRpZiAodHlwZW9mIGNhbGxiYWNrID09PSBcImZ1bmN0aW9uXCIpIHtcclxuXHRcdGlmICghdGhpcy5ldmVudEtleXNba2V5XSkge1xyXG5cdFx0XHR0aGlzLmV2ZW50S2V5c1trZXldID0ge1xyXG5cdFx0XHRcdHN1YnNjcmlwdGlvbnM6IHt9XHJcblx0XHRcdH07XHJcblx0XHR9XHJcblx0XHR2YXIgdG9rZW4gPSAoKyt0aGlzLmxhc3RTdWJzY3JpcHRpb25JZCkudG9TdHJpbmcoKTtcclxuXHRcdHRoaXMuZXZlbnRLZXlzW2tleV0uc3Vic2NyaXB0aW9uc1t0b2tlbl0gPSBjYWxsYmFjaztcclxuXHRcdHJldHVybiB0b2tlbjtcclxuXHR9IGVsc2Uge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxufTtcclxuXHJcbkV2ZW50QWdncmVnYXRvci5wcm90b3R5cGUub2ZmID0gZnVuY3Rpb24oa2V5LCB0b2tlbk9yQ2FsbGJhY2spIHtcclxuXHRpZiAodHlwZW9mIHRva2VuT3JDYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0Ly9DYWxsYmFjayByZWZlcmVuY2Ugd2FzIHBhc3NlZCBpbiBzbyBmaW5kIHRoZSBzdWJzY3JpcHRpb24gd2l0aCB0aGUgbWF0Y2hpbmcgZnVuY3Rpb25cclxuXHRcdGlmICh0aGlzLmV2ZW50S2V5c1trZXldKSB7XHJcblx0XHRcdHZhciBldmVudFN1YnNjcmlwdGlvbnMgPSB0aGlzLmV2ZW50S2V5c1trZXldLnN1YnNjcmlwdGlvbnM7XHJcblx0XHRcdHZhciBtYXRjaGluZ0lkID0gbnVsbDtcclxuXHRcdFx0Ly9mb3JlYWNoIHN1YnNjcmlwdGlvbiBzZWUgaWYgdGhlIGZ1bmN0aW9ucyBtYXRjaCBhbmQgc2F2ZSB0aGUga2V5IGlmIHllc1xyXG5cdFx0XHRmb3IgKHZhciBzdWJzY3JpcHRpb25JZCBpbiBldmVudFN1YnNjcmlwdGlvbnMpIHtcclxuXHRcdFx0XHRpZiAoZXZlbnRTdWJzY3JpcHRpb25zLmhhc093blByb3BlcnR5KHN1YnNjcmlwdGlvbklkKSkge1xyXG5cdFx0XHRcdFx0aWYgKGV2ZW50U3Vic2NyaXB0aW9uc1tzdWJzY3JpcHRpb25JZF0gPT09IHRva2VuT3JDYWxsYmFjaykge1xyXG5cdFx0XHRcdFx0XHRtYXRjaGluZ0lkID0gc3Vic2NyaXB0aW9uSWQ7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdGlmIChtYXRjaGluZ0lkICE9PSBudWxsKSB7XHJcblx0XHRcdFx0ZGVsZXRlIGV2ZW50U3Vic2NyaXB0aW9uc1ttYXRjaGluZ0lkXTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0gZWxzZSB7XHJcblx0XHQvL1Rva2VuIHdhcyBwYXNzZWQgaW5cclxuXHRcdGlmICh0aGlzLmV2ZW50S2V5c1trZXldICYmIHRoaXMuZXZlbnRLZXlzW2tleV0uc3Vic2NyaXB0aW9uc1t0b2tlbk9yQ2FsbGJhY2tdKSB7XHJcblx0XHRcdGRlbGV0ZSB0aGlzLmV2ZW50S2V5c1trZXldLnN1YnNjcmlwdGlvbnNbdG9rZW5PckNhbGxiYWNrXTtcclxuXHRcdH1cclxuXHR9XHJcbn07XHJcblxyXG5FdmVudEFnZ3JlZ2F0b3IucHJvdG90eXBlLnRyaWdnZXIgPSBmdW5jdGlvbihrZXkpIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblx0aWYgKHNlbGYuZXZlbnRLZXlzW2tleV0pIHtcclxuXHRcdHZhciB2YWx1ZXMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xyXG5cdFx0Ly9JZiBwYXNzaW5nIGxlc3MgdGhhbiB2YWx1ZXMgcGFzcyB0aGVtIGluZGl2aWR1YWxseVxyXG5cdFx0dmFyIGExID0gdmFsdWVzWzBdLFxyXG5cdFx0XHRhMiA9IHZhbHVlc1sxXSxcclxuXHRcdFx0YTMgPSB2YWx1ZXNbMl07XHJcblx0XHQvL0Vsc2UgaWYgcGFzc2luZyBtb3JlIHRoYW4gMyB2YWx1ZXMgZ3JvdXAgYXMgYW4gYXJncyBhcnJheVxyXG5cdFx0aWYgKHZhbHVlcy5sZW5ndGggPiAzKSB7XHJcblx0XHRcdGExID0gdmFsdWVzO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBzdWJzY3JpcHRpb25zID0gc2VsZi5ldmVudEtleXNba2V5XS5zdWJzY3JpcHRpb25zO1xyXG5cdFx0c2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuXHRcdFx0Zm9yICh2YXIgdG9rZW4gaW4gc3Vic2NyaXB0aW9ucykge1xyXG5cdFx0XHRcdGlmIChzdWJzY3JpcHRpb25zLmhhc093blByb3BlcnR5KHRva2VuKSkge1xyXG5cdFx0XHRcdFx0c3Vic2NyaXB0aW9uc1t0b2tlbl0oYTEsIGEyLCBhMyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9LCAwKTtcclxuXHR9XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50QWdncmVnYXRvcjsiLCJ2YXIgdGVtcGxhdGluZyA9IHtcclxuXHJcblx0UGxhY2Vob2xkZXI6IGZ1bmN0aW9uKHJhdykge1xyXG5cdFx0dGhpcy5yYXcgPSByYXc7XHJcblx0XHR0aGlzLmZ1bGxQcm9wZXJ0eSA9IHJhdy5zbGljZSgyLCByYXcubGVuZ3RoIC0gMik7XHJcblx0fSxcclxuXHJcblx0Z2V0UGxhY2VIb2xkZXJzOiBmdW5jdGlvbih0ZW1wbGF0ZSwgcmVnZXhwKSB7XHJcblx0XHR2YXIgcmVnRXhwUGF0dGVybiA9IHJlZ2V4cCB8fCAvXFx7XFx7W15cXH1dK1xcfVxcfT8vZztcclxuXHRcdHZhciBtYXRjaGVzID0gdGVtcGxhdGUubWF0Y2gocmVnRXhwUGF0dGVybik7XHJcblx0XHRyZXR1cm4gbWF0Y2hlcyB8fCBbXTtcclxuXHR9LFxyXG5cclxuXHRnZXRPYmplY3RWYWx1ZTogZnVuY3Rpb24ob2JqLCBmdWxsUHJvcGVydHkpIHtcclxuXHRcdHZhciB2YWx1ZSA9IG9iaixcclxuXHRcdFx0cHJvcGVydHlDaGFpbiA9IGZ1bGxQcm9wZXJ0eS5zcGxpdCgnLicpO1xyXG5cclxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcGVydHlDaGFpbi5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHR2YXIgcHJvcGVydHkgPSBwcm9wZXJ0eUNoYWluW2ldO1xyXG5cdFx0XHR2YWx1ZSA9IHZhbHVlW3Byb3BlcnR5XSAhPSBudWxsID8gdmFsdWVbcHJvcGVydHldIDogXCJOb3QgRm91bmQ6IFwiICsgZnVsbFByb3BlcnR5O1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmKGZ1bGxQcm9wZXJ0eSA9PT0gXCJfXCIpIHtcclxuXHRcdFx0dmFsdWUgPSBvYmo7XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdGlmICgodHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiKSAmJiB2YWx1ZS5pbmRleE9mKFwiL0RhdGUoXCIpICE9PSAtMSkge1xyXG5cdFx0XHR2YXIgZGF0ZVZhbHVlID0gVVRDSnNvblRvRGF0ZSh2YWx1ZSk7XHJcblx0XHRcdHZhbHVlID0gZGF0ZVZhbHVlLnRvTG9jYWxlRGF0ZVN0cmluZygpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB2YWx1ZTtcclxuXHR9LFxyXG5cclxuXHRwb3B1bGF0ZVRlbXBsYXRlOiBmdW5jdGlvbih0ZW1wbGF0ZSwgaXRlbSwgcmVnZXhwKSB7XHJcblx0XHR2YXIgcGxhY2Vob2xkZXJzID0gdGhpcy5nZXRQbGFjZUhvbGRlcnModGVtcGxhdGUsIHJlZ2V4cCkgfHwgW10sXHJcblx0XHRcdGl0ZW1IdG1sID0gdGVtcGxhdGU7XHJcblxyXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBwbGFjZWhvbGRlcnMubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0dmFyIHBsYWNlaG9sZGVyID0gbmV3IHRoaXMuUGxhY2Vob2xkZXIocGxhY2Vob2xkZXJzW2ldKTtcclxuXHRcdFx0cGxhY2Vob2xkZXIudmFsID0gdGhpcy5nZXRPYmplY3RWYWx1ZShpdGVtLCBwbGFjZWhvbGRlci5mdWxsUHJvcGVydHkpO1xyXG5cdFx0XHR2YXIgcGF0dGVybiA9IHBsYWNlaG9sZGVyLnJhdy5yZXBsYWNlKFwiW1wiLCBcIlxcXFxbXCIpLnJlcGxhY2UoXCJdXCIsIFwiXFxcXF1cIik7XHJcblx0XHRcdHZhciBtb2RpZmllciA9IFwiZ1wiO1xyXG5cdFx0XHRpdGVtSHRtbCA9IGl0ZW1IdG1sLnJlcGxhY2UobmV3IFJlZ0V4cChwYXR0ZXJuLCBtb2RpZmllciksIHBsYWNlaG9sZGVyLnZhbCk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gaXRlbUh0bWw7XHJcblx0fVxyXG59O1xyXG5cclxudGVtcGxhdGluZy5FYWNoID0ge1xyXG5cclxuXHRyZWdFeHA6IC9cXHtcXFtbXlxcXV0rXFxdXFx9Py9nLFxyXG5cclxuXHRwb3B1bGF0ZUVhY2hUZW1wbGF0ZXM6IGZ1bmN0aW9uKGl0ZW1IdG1sLCBpdGVtKSB7XHJcblx0XHR2YXIgJGl0ZW1IdG1sID0gJChpdGVtSHRtbCksXHJcblx0XHRcdGVhY2hUZW1wbGF0ZXMgPSAkaXRlbUh0bWwuZmluZChcIltkYXRhLWVhY2hdXCIpO1xyXG5cclxuXHRcdGVhY2hUZW1wbGF0ZXMuZWFjaChmdW5jdGlvbigpIHtcclxuXHRcdFx0dmFyIGFycmF5SHRtbCA9IFwiXCIsXHJcblx0XHRcdFx0aXRlbVRlbXBsYXRlID0gJCh0aGlzKS5odG1sKCksXHJcblx0XHRcdFx0YXJyYXlQcm9wID0gJCh0aGlzKS5kYXRhKFwiZWFjaFwiKSxcclxuXHRcdFx0XHRhcnJheSA9IHNwLnRlbXBsYXRpbmcuZ2V0T2JqZWN0VmFsdWUoaXRlbSwgYXJyYXlQcm9wKTtcclxuXHJcblx0XHRcdGlmIChhcnJheSAhPSBudWxsICYmICQuaXNBcnJheShhcnJheSkpIHtcclxuXHRcdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0XHRhcnJheUh0bWwgKz0gdGVtcGxhdGluZy5wb3B1bGF0ZVRlbXBsYXRlKGl0ZW1UZW1wbGF0ZSwgYXJyYXlbaV0sIHRlbXBsYXRpbmcuRWFjaC5yZWdFeHApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0JGl0ZW1IdG1sLmZpbmQoJCh0aGlzKSkuaHRtbChhcnJheUh0bWwpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dmFyIHRlbXAgPSAkaXRlbUh0bWwuY2xvbmUoKS53cmFwKFwiPGRpdj5cIik7XHJcblx0XHRyZXR1cm4gdGVtcC5wYXJlbnQoKS5odG1sKCk7XHJcblx0fVxyXG59O1xyXG5cclxudGVtcGxhdGluZy5yZW5kZXJUZW1wbGF0ZSA9IGZ1bmN0aW9uKHRlbXBsYXRlLCBpdGVtLCByZW5kZXJFYWNoVGVtcGxhdGUpIHtcclxuXHR2YXIgaXRlbUh0bWwgPSB0ZW1wbGF0aW5nLnBvcHVsYXRlVGVtcGxhdGUodGVtcGxhdGUsIGl0ZW0pO1xyXG5cdGlmIChyZW5kZXJFYWNoVGVtcGxhdGUpIHtcclxuXHRcdGl0ZW1IdG1sID0gdGVtcGxhdGluZy5FYWNoLnBvcHVsYXRlRWFjaFRlbXBsYXRlcyhpdGVtSHRtbCwgaXRlbSk7XHJcblx0fVxyXG5cdHJldHVybiBpdGVtSHRtbDtcclxufTtcclxuXHJcbnZhciBVVENKc29uVG9EYXRlID0gZnVuY3Rpb24oanNvbkRhdGUpIHtcclxuXHR2YXIgdXRjU3RyID0ganNvbkRhdGUuc3Vic3RyaW5nKGpzb25EYXRlLmluZGV4T2YoXCIoXCIpICsgMSk7XHJcblx0dXRjU3RyID0gdXRjU3RyLnN1YnN0cmluZygwLCB1dGNTdHIuaW5kZXhPZihcIilcIikpO1xyXG5cclxuXHR2YXIgcmV0dXJuRGF0ZSA9IG5ldyBEYXRlKHBhcnNlSW50KHV0Y1N0ciwgMTApKTtcclxuXHR2YXIgaG91ck9mZnNldCA9IHJldHVybkRhdGUuZ2V0VGltZXpvbmVPZmZzZXQoKSAvIDYwO1xyXG5cdHJldHVybkRhdGUuc2V0SG91cnMocmV0dXJuRGF0ZS5nZXRIb3VycygpICsgaG91ck9mZnNldCk7XHJcblxyXG5cdHJldHVybiByZXR1cm5EYXRlO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB0ZW1wbGF0aW5nOyIsIi8qIVxyXG4gKiBPYmplY3Qub2JzZXJ2ZSBwb2x5ZmlsbCAtIHYwLjIuM1xyXG4gKiBieSBNYXNzaW1vIEFydGl6enUgKE1heEFydDI1MDEpXHJcbiAqIFxyXG4gKiBodHRwczovL2dpdGh1Yi5jb20vTWF4QXJ0MjUwMS9vYmplY3Qtb2JzZXJ2ZVxyXG4gKiBcclxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlXHJcbiAqIFNlZSBMSUNFTlNFIGZvciBkZXRhaWxzXHJcbiAqL1xyXG5cclxuLy8gU29tZSB0eXBlIGRlZmluaXRpb25zXHJcbi8qKlxyXG4gKiBUaGlzIHJlcHJlc2VudHMgdGhlIGRhdGEgcmVsYXRpdmUgdG8gYW4gb2JzZXJ2ZWQgb2JqZWN0XHJcbiAqIEB0eXBlZGVmICB7T2JqZWN0fSAgICAgICAgICAgICAgICAgICAgIE9iamVjdERhdGFcclxuICogQHByb3BlcnR5IHtNYXA8SGFuZGxlciwgSGFuZGxlckRhdGE+fSAgaGFuZGxlcnNcclxuICogQHByb3BlcnR5IHtTdHJpbmdbXX0gICAgICAgICAgICAgICAgICAgcHJvcGVydGllc1xyXG4gKiBAcHJvcGVydHkgeypbXX0gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXNcclxuICogQHByb3BlcnR5IHtEZXNjcmlwdG9yW119ICAgICAgICAgICAgICAgZGVzY3JpcHRvcnNcclxuICogQHByb3BlcnR5IHtOb3RpZmllcn0gICAgICAgICAgICAgICAgICAgbm90aWZpZXJcclxuICogQHByb3BlcnR5IHtCb29sZWFufSAgICAgICAgICAgICAgICAgICAgZnJvemVuXHJcbiAqIEBwcm9wZXJ0eSB7Qm9vbGVhbn0gICAgICAgICAgICAgICAgICAgIGV4dGVuc2libGVcclxuICogQHByb3BlcnR5IHtPYmplY3R9ICAgICAgICAgICAgICAgICAgICAgcHJvdG9cclxuICovXHJcbi8qKlxyXG4gKiBGdW5jdGlvbiBkZWZpbml0aW9uIG9mIGEgaGFuZGxlclxyXG4gKiBAY2FsbGJhY2sgSGFuZGxlclxyXG4gKiBAcGFyYW0ge0NoYW5nZVJlY29yZFtdfSAgICAgICAgICAgICAgICBjaGFuZ2VzXHJcbiovXHJcbi8qKlxyXG4gKiBUaGlzIHJlcHJlc2VudHMgdGhlIGRhdGEgcmVsYXRpdmUgdG8gYW4gb2JzZXJ2ZWQgb2JqZWN0IGFuZCBvbmUgb2YgaXRzXHJcbiAqIGhhbmRsZXJzXHJcbiAqIEB0eXBlZGVmICB7T2JqZWN0fSAgICAgICAgICAgICAgICAgICAgIEhhbmRsZXJEYXRhXHJcbiAqIEBwcm9wZXJ0eSB7TWFwPE9iamVjdCwgT2JzZXJ2ZWREYXRhPn0gIG9ic2VydmVkXHJcbiAqIEBwcm9wZXJ0eSB7Q2hhbmdlUmVjb3JkW119ICAgICAgICAgICAgIGNoYW5nZVJlY29yZHNcclxuICovXHJcbi8qKlxyXG4gKiBAdHlwZWRlZiAge09iamVjdH0gICAgICAgICAgICAgICAgICAgICBPYnNlcnZlZERhdGFcclxuICogQHByb3BlcnR5IHtTdHJpbmdbXX0gICAgICAgICAgICAgICAgICAgYWNjZXB0TGlzdFxyXG4gKiBAcHJvcGVydHkge09iamVjdERhdGF9ICAgICAgICAgICAgICAgICBkYXRhXHJcbiovXHJcbi8qKlxyXG4gKiBUeXBlIGRlZmluaXRpb24gZm9yIGEgY2hhbmdlLiBBbnkgb3RoZXIgcHJvcGVydHkgY2FuIGJlIGFkZGVkIHVzaW5nXHJcbiAqIHRoZSBub3RpZnkoKSBvciBwZXJmb3JtQ2hhbmdlKCkgbWV0aG9kcyBvZiB0aGUgbm90aWZpZXIuXHJcbiAqIEB0eXBlZGVmICB7T2JqZWN0fSAgICAgICAgICAgICAgICAgICAgIENoYW5nZVJlY29yZFxyXG4gKiBAcHJvcGVydHkge1N0cmluZ30gICAgICAgICAgICAgICAgICAgICB0eXBlXHJcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0fSAgICAgICAgICAgICAgICAgICAgIG9iamVjdFxyXG4gKiBAcHJvcGVydHkge1N0cmluZ30gICAgICAgICAgICAgICAgICAgICBbbmFtZV1cclxuICogQHByb3BlcnR5IHsqfSAgICAgICAgICAgICAgICAgICAgICAgICAgW29sZFZhbHVlXVxyXG4gKiBAcHJvcGVydHkge051bWJlcn0gICAgICAgICAgICAgICAgICAgICBbaW5kZXhdXHJcbiAqL1xyXG4vKipcclxuICogVHlwZSBkZWZpbml0aW9uIGZvciBhIG5vdGlmaWVyICh3aGF0IE9iamVjdC5nZXROb3RpZmllciByZXR1cm5zKVxyXG4gKiBAdHlwZWRlZiAge09iamVjdH0gICAgICAgICAgICAgICAgICAgICBOb3RpZmllclxyXG4gKiBAcHJvcGVydHkge0Z1bmN0aW9ufSAgICAgICAgICAgICAgICAgICBub3RpZnlcclxuICogQHByb3BlcnR5IHtGdW5jdGlvbn0gICAgICAgICAgICAgICAgICAgcGVyZm9ybUNoYW5nZVxyXG4gKi9cclxuLyoqXHJcbiAqIEZ1bmN0aW9uIGNhbGxlZCB3aXRoIE5vdGlmaWVyLnBlcmZvcm1DaGFuZ2UuIEl0IG1heSBvcHRpb25hbGx5IHJldHVybiBhXHJcbiAqIENoYW5nZVJlY29yZCB0aGF0IGdldHMgYXV0b21hdGljYWxseSBub3RpZmllZCwgYnV0IGB0eXBlYCBhbmQgYG9iamVjdGBcclxuICogcHJvcGVydGllcyBhcmUgb3ZlcnJpZGRlbi5cclxuICogQGNhbGxiYWNrIFBlcmZvcm1lclxyXG4gKiBAcmV0dXJucyB7Q2hhbmdlUmVjb3JkfHVuZGVmaW5lZH1cclxuICovXHJcblxyXG5PYmplY3Qub2JzZXJ2ZSB8fCAoZnVuY3Rpb24oTywgQSwgcm9vdCkge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFJlbGF0ZXMgb2JzZXJ2ZWQgb2JqZWN0cyBhbmQgdGhlaXIgZGF0YVxyXG4gICAgICAgICAqIEB0eXBlIHtNYXA8T2JqZWN0LCBPYmplY3REYXRhfVxyXG4gICAgICAgICAqL1xyXG4gICAgdmFyIG9ic2VydmVkLFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIExpc3Qgb2YgaGFuZGxlcnMgYW5kIHRoZWlyIGRhdGFcclxuICAgICAgICAgKiBAdHlwZSB7TWFwPEhhbmRsZXIsIE1hcDxPYmplY3QsIEhhbmRsZXJEYXRhPj59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaGFuZGxlcnMsXHJcblxyXG4gICAgICAgIGRlZmF1bHRBY2NlcHRMaXN0ID0gWyBcImFkZFwiLCBcInVwZGF0ZVwiLCBcImRlbGV0ZVwiLCBcInJlY29uZmlndXJlXCIsIFwic2V0UHJvdG90eXBlXCIsIFwicHJldmVudEV4dGVuc2lvbnNcIiBdO1xyXG5cclxuICAgIC8vIEZ1bmN0aW9ucyBmb3IgaW50ZXJuYWwgdXNhZ2VcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQ2hlY2tzIGlmIHRoZSBhcmd1bWVudCBpcyBhbiBBcnJheSBvYmplY3QuIFBvbHlmaWxscyBBcnJheS5pc0FycmF5LlxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBpc0FycmF5XHJcbiAgICAgICAgICogQHBhcmFtIHs/Kn0gb2JqZWN0XHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICB2YXIgaXNBcnJheSA9IEEuaXNBcnJheSB8fCAoZnVuY3Rpb24odG9TdHJpbmcpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChvYmplY3QpIHsgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqZWN0KSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiOyB9O1xyXG4gICAgICAgIH0pKE8ucHJvdG90eXBlLnRvU3RyaW5nKSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogUmV0dXJucyB0aGUgaW5kZXggb2YgYW4gaXRlbSBpbiBhIGNvbGxlY3Rpb24sIG9yIC0xIGlmIG5vdCBmb3VuZC5cclxuICAgICAgICAgKiBVc2VzIHRoZSBnZW5lcmljIEFycmF5LmluZGV4T2Ygb3IgQXJyYXkucHJvdG90eXBlLmluZGV4T2YgaWYgYXZhaWxhYmxlLlxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBpbkFycmF5XHJcbiAgICAgICAgICogQHBhcmFtIHtBcnJheX0gYXJyYXlcclxuICAgICAgICAgKiBAcGFyYW0geyp9IHBpdm90ICAgICAgICAgICBJdGVtIHRvIGxvb2sgZm9yXHJcbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ9IFtzdGFydD0wXSAgSW5kZXggdG8gc3RhcnQgZnJvbVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtOdW1iZXJ9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5BcnJheSA9IEEucHJvdG90eXBlLmluZGV4T2YgPyBBLmluZGV4T2YgfHwgZnVuY3Rpb24oYXJyYXksIHBpdm90LCBzdGFydCkge1xyXG4gICAgICAgICAgICByZXR1cm4gQS5wcm90b3R5cGUuaW5kZXhPZi5jYWxsKGFycmF5LCBwaXZvdCwgc3RhcnQpO1xyXG4gICAgICAgIH0gOiBmdW5jdGlvbihhcnJheSwgcGl2b3QsIHN0YXJ0KSB7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSBzdGFydCB8fCAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgICAgICAgICBpZiAoYXJyYXlbaV0gPT09IHBpdm90KVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBpO1xyXG4gICAgICAgICAgICByZXR1cm4gLTE7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBNYXAsIG9yIGEgTWFwLWxpa2Ugb2JqZWN0IGlzIE1hcCBpcyBub3RcclxuICAgICAgICAgKiBzdXBwb3J0ZWQgb3IgZG9lc24ndCBzdXBwb3J0IGZvckVhY2goKVxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBjcmVhdGVNYXBcclxuICAgICAgICAgKiBAcmV0dXJucyB7TWFwfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGNyZWF0ZU1hcCA9IHR5cGVvZiByb290Lk1hcCA9PT0gXCJ1bmRlZmluZWRcIiB8fCAhTWFwLnByb3RvdHlwZS5mb3JFYWNoID8gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIC8vIExpZ2h0d2VpZ2h0IHNoaW0gb2YgTWFwLiBMYWNrcyBjbGVhcigpLCBlbnRyaWVzKCksIGtleXMoKSBhbmRcclxuICAgICAgICAgICAgLy8gdmFsdWVzKCkgKHRoZSBsYXN0IDMgbm90IHN1cHBvcnRlZCBieSBJRTExLCBzbyBjYW4ndCB1c2UgdGhlbSksXHJcbiAgICAgICAgICAgIC8vIGl0IGRvZXNuJ3QgaGFuZGxlIHRoZSBjb25zdHJ1Y3RvcidzIGFyZ3VtZW50IChsaWtlIElFMTEpIGFuZCBvZlxyXG4gICAgICAgICAgICAvLyBjb3Vyc2UgaXQgZG9lc24ndCBzdXBwb3J0IGZvci4uLm9mLlxyXG4gICAgICAgICAgICAvLyBDaHJvbWUgMzEtMzUgYW5kIEZpcmVmb3ggMTMtMjQgaGF2ZSBhIGJhc2ljIHN1cHBvcnQgb2YgTWFwLCBidXRcclxuICAgICAgICAgICAgLy8gdGhleSBsYWNrIGZvckVhY2goKSwgc28gdGhlaXIgbmF0aXZlIGltcGxlbWVudGF0aW9uIGlzIGJhZCBmb3JcclxuICAgICAgICAgICAgLy8gdGhpcyBwb2x5ZmlsbC4gKENocm9tZSAzNisgc3VwcG9ydHMgT2JqZWN0Lm9ic2VydmUuKVxyXG4gICAgICAgICAgICB2YXIga2V5cyA9IFtdLCB2YWx1ZXMgPSBbXTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzaXplOiAwLFxyXG4gICAgICAgICAgICAgICAgaGFzOiBmdW5jdGlvbihrZXkpIHsgcmV0dXJuIGluQXJyYXkoa2V5cywga2V5KSA+IC0xOyB9LFxyXG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbihrZXkpIHsgcmV0dXJuIHZhbHVlc1tpbkFycmF5KGtleXMsIGtleSldOyB9LFxyXG4gICAgICAgICAgICAgICAgc2V0OiBmdW5jdGlvbihrZXksIHZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGkgPSBpbkFycmF5KGtleXMsIGtleSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGkgPT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleXMucHVzaChrZXkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXMucHVzaCh2YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2l6ZSsrO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB2YWx1ZXNbaV0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBcImRlbGV0ZVwiOiBmdW5jdGlvbihrZXkpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgaSA9IGluQXJyYXkoa2V5cywga2V5KTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaSA+IC0xKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleXMuc3BsaWNlKGksIDEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXMuc3BsaWNlKGksIDEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNpemUtLTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZm9yRWFjaDogZnVuY3Rpb24oY2FsbGJhY2svKiwgdGhpc09iaiovKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjay5jYWxsKGFyZ3VtZW50c1sxXSwgdmFsdWVzW2ldLCBrZXlzW2ldLCB0aGlzKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IDogZnVuY3Rpb24oKSB7IHJldHVybiBuZXcgTWFwKCk7IH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFNpbXBsZSBzaGltIGZvciBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyB3aGVuIGlzIG5vdCBhdmFpbGFibGVcclxuICAgICAgICAgKiBNaXNzZXMgY2hlY2tzIG9uIG9iamVjdCwgZG9uJ3QgdXNlIGFzIGEgcmVwbGFjZW1lbnQgb2YgT2JqZWN0LmtleXMvZ2V0T3duUHJvcGVydHlOYW1lc1xyXG4gICAgICAgICAqIEBmdW5jdGlvbiBnZXRQcm9wc1xyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7U3RyaW5nW119XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0UHJvcHMgPSBPLmdldE93blByb3BlcnR5TmFtZXMgPyAoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHZhciBmdW5jID0gTy5nZXRPd25Qcm9wZXJ0eU5hbWVzO1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgYXJndW1lbnRzLmNhbGxlZTtcclxuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgLy8gU3RyaWN0IG1vZGUgaXMgc3VwcG9ydGVkXHJcblxyXG4gICAgICAgICAgICAgICAgLy8gSW4gc3RyaWN0IG1vZGUsIHdlIGNhbid0IGFjY2VzcyB0byBcImFyZ3VtZW50c1wiLCBcImNhbGxlclwiIGFuZFxyXG4gICAgICAgICAgICAgICAgLy8gXCJjYWxsZWVcIiBwcm9wZXJ0aWVzIG9mIGZ1bmN0aW9ucy4gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXNcclxuICAgICAgICAgICAgICAgIC8vIHJldHVybnMgWyBcInByb3RvdHlwZVwiLCBcImxlbmd0aFwiLCBcIm5hbWVcIiBdIGluIEZpcmVmb3g7IGl0IHJldHVybnNcclxuICAgICAgICAgICAgICAgIC8vIFwiY2FsbGVyXCIgYW5kIFwiYXJndW1lbnRzXCIgdG9vIGluIENocm9tZSBhbmQgaW4gSW50ZXJuZXRcclxuICAgICAgICAgICAgICAgIC8vIEV4cGxvcmVyLCBzbyB0aG9zZSB2YWx1ZXMgbXVzdCBiZSBmaWx0ZXJlZC5cclxuICAgICAgICAgICAgICAgIHZhciBhdm9pZCA9IChmdW5jKGluQXJyYXkpLmpvaW4oXCIgXCIpICsgXCIgXCIpLnJlcGxhY2UoL3Byb3RvdHlwZSB8bGVuZ3RoIHxuYW1lIC9nLCBcIlwiKS5zbGljZSgwLCAtMSkuc3BsaXQoXCIgXCIpO1xyXG4gICAgICAgICAgICAgICAgaWYgKGF2b2lkLmxlbmd0aCkgZnVuYyA9IGZ1bmN0aW9uKG9iamVjdCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBwcm9wcyA9IE8uZ2V0T3duUHJvcGVydHlOYW1lcyhvYmplY3QpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2Ygb2JqZWN0ID09PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBqOyBpIDwgYXZvaWQubGVuZ3RoOylcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICgoaiA9IGluQXJyYXkocHJvcHMsIGF2b2lkW2krK10pKSA+IC0xKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BzLnNwbGljZShqLCAxKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByb3BzO1xyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gZnVuYztcclxuICAgICAgICB9KSgpIDogZnVuY3Rpb24ob2JqZWN0KSB7XHJcbiAgICAgICAgICAgIC8vIFBvb3ItbW91dGggdmVyc2lvbiB3aXRoIGZvci4uLmluIChJRTgtKVxyXG4gICAgICAgICAgICB2YXIgcHJvcHMgPSBbXSwgcHJvcCwgaG9wO1xyXG4gICAgICAgICAgICBpZiAoXCJoYXNPd25Qcm9wZXJ0eVwiIGluIG9iamVjdCkge1xyXG4gICAgICAgICAgICAgICAgZm9yIChwcm9wIGluIG9iamVjdClcclxuICAgICAgICAgICAgICAgICAgICBpZiAob2JqZWN0Lmhhc093blByb3BlcnR5KHByb3ApKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wcy5wdXNoKHByb3ApO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgaG9wID0gTy5oYXNPd25Qcm9wZXJ0eTtcclxuICAgICAgICAgICAgICAgIGZvciAocHJvcCBpbiBvYmplY3QpXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGhvcC5jYWxsKG9iamVjdCwgcHJvcCkpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BzLnB1c2gocHJvcCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIEluc2VydGluZyBhIGNvbW1vbiBub24tZW51bWVyYWJsZSBwcm9wZXJ0eSBvZiBhcnJheXNcclxuICAgICAgICAgICAgaWYgKGlzQXJyYXkob2JqZWN0KSlcclxuICAgICAgICAgICAgICAgIHByb3BzLnB1c2goXCJsZW5ndGhcIik7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gcHJvcHM7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogUmV0dXJuIHRoZSBwcm90b3R5cGUgb2YgdGhlIG9iamVjdC4uLiBpZiBkZWZpbmVkLlxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBnZXRQcm90b3R5cGVcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XHJcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH1cclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXRQcm90b3R5cGUgPSBPLmdldFByb3RvdHlwZU9mLFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBSZXR1cm4gdGhlIGRlc2NyaXB0b3Igb2YgdGhlIG9iamVjdC4uLiBpZiBkZWZpbmVkLlxyXG4gICAgICAgICAqIElFOCBzdXBwb3J0cyBhICh1c2VsZXNzKSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIGZvciBET01cclxuICAgICAgICAgKiBub2RlcyBvbmx5LCBzbyBkZWZpbmVQcm9wZXJ0aWVzIGlzIGNoZWNrZWQgaW5zdGVhZC5cclxuICAgICAgICAgKiBAZnVuY3Rpb24gZ2V0RGVzY3JpcHRvclxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHlcclxuICAgICAgICAgKiBAcmV0dXJucyB7RGVzY3JpcHRvcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXREZXNjcmlwdG9yID0gTy5kZWZpbmVQcm9wZXJ0aWVzICYmIE8uZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yLFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBTZXRzIHVwIHRoZSBuZXh0IGNoZWNrIGFuZCBkZWxpdmVyaW5nIGl0ZXJhdGlvbiwgdXNpbmdcclxuICAgICAgICAgKiByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgb3IgYSAoY2xvc2UpIHBvbHlmaWxsLlxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBuZXh0RnJhbWVcclxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBmdW5jXHJcbiAgICAgICAgICogQHJldHVybnMge251bWJlcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBuZXh0RnJhbWUgPSByb290LnJlcXVlc3RBbmltYXRpb25GcmFtZSB8fCByb290LndlYmtpdFJlcXVlc3RBbmltYXRpb25GcmFtZSB8fCAoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHZhciBpbml0aWFsID0gK25ldyBEYXRlLFxyXG4gICAgICAgICAgICAgICAgbGFzdCA9IGluaXRpYWw7XHJcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihmdW5jKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgbm93ID0gK25ldyBEYXRlO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZnVuYygobGFzdCA9ICtuZXcgRGF0ZSkgLSBpbml0aWFsKTtcclxuICAgICAgICAgICAgICAgIH0sIDE3KTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9KSgpLFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBTZXRzIHVwIHRoZSBvYnNlcnZhdGlvbiBvZiBhbiBvYmplY3RcclxuICAgICAgICAgKiBAZnVuY3Rpb24gZG9PYnNlcnZlXHJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxyXG4gICAgICAgICAqIEBwYXJhbSB7SGFuZGxlcn0gaGFuZGxlclxyXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nW119IFthY2NlcHRMaXN0XVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGRvT2JzZXJ2ZSA9IGZ1bmN0aW9uKG9iamVjdCwgaGFuZGxlciwgYWNjZXB0TGlzdCkge1xyXG5cclxuICAgICAgICAgICAgdmFyIGRhdGEgPSBvYnNlcnZlZC5nZXQob2JqZWN0KTtcclxuXHJcbiAgICAgICAgICAgIGlmIChkYXRhKVxyXG4gICAgICAgICAgICAgICAgc2V0SGFuZGxlcihvYmplY3QsIGRhdGEsIGhhbmRsZXIsIGFjY2VwdExpc3QpO1xyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGRhdGEgPSBjcmVhdGVPYmplY3REYXRhKG9iamVjdCk7XHJcbiAgICAgICAgICAgICAgICBzZXRIYW5kbGVyKG9iamVjdCwgZGF0YSwgaGFuZGxlciwgYWNjZXB0TGlzdCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmIChvYnNlcnZlZC5zaXplID09PSAxKVxyXG4gICAgICAgICAgICAgICAgICAgIC8vIExldCB0aGUgb2JzZXJ2YXRpb24gYmVnaW4hXHJcbiAgICAgICAgICAgICAgICAgICAgbmV4dEZyYW1lKHJ1bkdsb2JhbExvb3ApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQ3JlYXRlcyB0aGUgaW5pdGlhbCBkYXRhIGZvciBhbiBvYnNlcnZlZCBvYmplY3RcclxuICAgICAgICAgKiBAZnVuY3Rpb24gY3JlYXRlT2JqZWN0RGF0YVxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAgICAgKi9cclxuICAgICAgICBjcmVhdGVPYmplY3REYXRhID0gZnVuY3Rpb24ob2JqZWN0LCBkYXRhKSB7XHJcbiAgICAgICAgICAgIHZhciBwcm9wcyA9IGdldFByb3BzKG9iamVjdCksXHJcbiAgICAgICAgICAgICAgICB2YWx1ZXMgPSBbXSwgZGVzY3MsIGkgPSAwLFxyXG4gICAgICAgICAgICAgICAgZGF0YSA9IHtcclxuICAgICAgICAgICAgICAgICAgICBoYW5kbGVyczogY3JlYXRlTWFwKCksXHJcbiAgICAgICAgICAgICAgICAgICAgZnJvemVuOiBPLmlzRnJvemVuID8gTy5pc0Zyb3plbihvYmplY3QpIDogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgZXh0ZW5zaWJsZTogTy5pc0V4dGVuc2libGUgPyBPLmlzRXh0ZW5zaWJsZShvYmplY3QpIDogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBwcm90bzogZ2V0UHJvdG90eXBlICYmIGdldFByb3RvdHlwZShvYmplY3QpLFxyXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHByb3BzLFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlczogdmFsdWVzLFxyXG4gICAgICAgICAgICAgICAgICAgIG5vdGlmaWVyOiByZXRyaWV2ZU5vdGlmaWVyKG9iamVjdCwgZGF0YSlcclxuICAgICAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICBpZiAoZ2V0RGVzY3JpcHRvcikge1xyXG4gICAgICAgICAgICAgICAgZGVzY3MgPSBkYXRhLmRlc2NyaXB0b3JzID0gW107XHJcbiAgICAgICAgICAgICAgICB3aGlsZSAoaSA8IHByb3BzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGRlc2NzW2ldID0gZ2V0RGVzY3JpcHRvcihvYmplY3QsIHByb3BzW2ldKTtcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZXNbaV0gPSBvYmplY3RbcHJvcHNbaSsrXV07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSB3aGlsZSAoaSA8IHByb3BzLmxlbmd0aClcclxuICAgICAgICAgICAgICAgIHZhbHVlc1tpXSA9IG9iamVjdFtwcm9wc1tpKytdXTtcclxuXHJcbiAgICAgICAgICAgIG9ic2VydmVkLnNldChvYmplY3QsIGRhdGEpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGRhdGE7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogUGVyZm9ybXMgYmFzaWMgcHJvcGVydHkgdmFsdWUgY2hhbmdlIGNoZWNrcyBvbiBhbiBvYnNlcnZlZCBvYmplY3RcclxuICAgICAgICAgKiBAZnVuY3Rpb24gcGVyZm9ybVByb3BlcnR5Q2hlY2tzXHJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3REYXRhfSBkYXRhXHJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxyXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBbZXhjZXB0XSAgRG9lc24ndCBkZWxpdmVyIHRoZSBjaGFuZ2VzIHRvIHRoZVxyXG4gICAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlcnMgdGhhdCBhY2NlcHQgdGhpcyB0eXBlXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgcGVyZm9ybVByb3BlcnR5Q2hlY2tzID0gKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB2YXIgdXBkYXRlQ2hlY2sgPSBnZXREZXNjcmlwdG9yID8gZnVuY3Rpb24ob2JqZWN0LCBkYXRhLCBpZHgsIGV4Y2VwdCwgZGVzY3IpIHtcclxuICAgICAgICAgICAgICAgIHZhciBrZXkgPSBkYXRhLnByb3BlcnRpZXNbaWR4XSxcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IG9iamVjdFtrZXldLFxyXG4gICAgICAgICAgICAgICAgICAgIG92YWx1ZSA9IGRhdGEudmFsdWVzW2lkeF0sXHJcbiAgICAgICAgICAgICAgICAgICAgb2Rlc2MgPSBkYXRhLmRlc2NyaXB0b3JzW2lkeF07XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKFwidmFsdWVcIiBpbiBkZXNjciAmJiAob3ZhbHVlID09PSB2YWx1ZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA/IG92YWx1ZSA9PT0gMCAmJiAxL292YWx1ZSAhPT0gMS92YWx1ZSBcclxuICAgICAgICAgICAgICAgICAgICAgICAgOiBvdmFsdWUgPT09IG92YWx1ZSB8fCB2YWx1ZSA9PT0gdmFsdWUpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYWRkQ2hhbmdlUmVjb3JkKG9iamVjdCwgZGF0YSwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBrZXksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwidXBkYXRlXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdDogb2JqZWN0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZTogb3ZhbHVlXHJcbiAgICAgICAgICAgICAgICAgICAgfSwgZXhjZXB0KTtcclxuICAgICAgICAgICAgICAgICAgICBkYXRhLnZhbHVlc1tpZHhdID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAob2Rlc2MuY29uZmlndXJhYmxlICYmICghZGVzY3IuY29uZmlndXJhYmxlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHx8IGRlc2NyLndyaXRhYmxlICE9PSBvZGVzYy53cml0YWJsZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB8fCBkZXNjci5lbnVtZXJhYmxlICE9PSBvZGVzYy5lbnVtZXJhYmxlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHx8IGRlc2NyLmdldCAhPT0gb2Rlc2MuZ2V0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHx8IGRlc2NyLnNldCAhPT0gb2Rlc2Muc2V0KSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGFkZENoYW5nZVJlY29yZChvYmplY3QsIGRhdGEsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZToga2V5LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcInJlY29uZmlndXJlXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdDogb2JqZWN0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZTogb3ZhbHVlXHJcbiAgICAgICAgICAgICAgICAgICAgfSwgZXhjZXB0KTtcclxuICAgICAgICAgICAgICAgICAgICBkYXRhLmRlc2NyaXB0b3JzW2lkeF0gPSBkZXNjcjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSA6IGZ1bmN0aW9uKG9iamVjdCwgZGF0YSwgaWR4LCBleGNlcHQpIHtcclxuICAgICAgICAgICAgICAgIHZhciBrZXkgPSBkYXRhLnByb3BlcnRpZXNbaWR4XSxcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IG9iamVjdFtrZXldLFxyXG4gICAgICAgICAgICAgICAgICAgIG92YWx1ZSA9IGRhdGEudmFsdWVzW2lkeF07XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKG92YWx1ZSA9PT0gdmFsdWUgPyBvdmFsdWUgPT09IDAgJiYgMS9vdmFsdWUgIT09IDEvdmFsdWUgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDogb3ZhbHVlID09PSBvdmFsdWUgfHwgdmFsdWUgPT09IHZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYWRkQ2hhbmdlUmVjb3JkKG9iamVjdCwgZGF0YSwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBrZXksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwidXBkYXRlXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdDogb2JqZWN0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZTogb3ZhbHVlXHJcbiAgICAgICAgICAgICAgICAgICAgfSwgZXhjZXB0KTtcclxuICAgICAgICAgICAgICAgICAgICBkYXRhLnZhbHVlc1tpZHhdID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICAvLyBDaGVja3MgaWYgc29tZSBwcm9wZXJ0eSBoYXMgYmVlbiBkZWxldGVkXHJcbiAgICAgICAgICAgIHZhciBkZWxldGlvbkNoZWNrID0gZ2V0RGVzY3JpcHRvciA/IGZ1bmN0aW9uKG9iamVjdCwgcHJvcHMsIHByb3BsZW4sIGRhdGEsIGV4Y2VwdCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGkgPSBwcm9wcy5sZW5ndGgsIGRlc2NyO1xyXG4gICAgICAgICAgICAgICAgd2hpbGUgKHByb3BsZW4gJiYgaS0tKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BzW2ldICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyID0gZ2V0RGVzY3JpcHRvcihvYmplY3QsIHByb3BzW2ldKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGxlbi0tO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgdGhlcmUncyBubyBkZXNjcmlwdG9yLCB0aGUgcHJvcGVydHkgaGFzIHJlYWxseVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBiZWVuIGRlbGV0ZWQ7IG90aGVyd2lzZSwgaXQncyBiZWVuIHJlY29uZmlndXJlZCBzb1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGF0J3Mgbm90IGVudW1lcmFibGUgYW55bW9yZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGVzY3IpIHVwZGF0ZUNoZWNrKG9iamVjdCwgZGF0YSwgaSwgZXhjZXB0LCBkZXNjcik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkQ2hhbmdlUmVjb3JkKG9iamVjdCwgZGF0YSwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHByb3BzW2ldLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwiZGVsZXRlXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiBvYmplY3QsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWU6IGRhdGEudmFsdWVzW2ldXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBleGNlcHQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YS5wcm9wZXJ0aWVzLnNwbGljZShpLCAxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEudmFsdWVzLnNwbGljZShpLCAxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEuZGVzY3JpcHRvcnMuc3BsaWNlKGksIDEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IDogZnVuY3Rpb24ob2JqZWN0LCBwcm9wcywgcHJvcGxlbiwgZGF0YSwgZXhjZXB0KSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgaSA9IHByb3BzLmxlbmd0aDtcclxuICAgICAgICAgICAgICAgIHdoaWxlIChwcm9wbGVuICYmIGktLSlcclxuICAgICAgICAgICAgICAgICAgICBpZiAocHJvcHNbaV0gIT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWRkQ2hhbmdlUmVjb3JkKG9iamVjdCwgZGF0YSwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogcHJvcHNbaV0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcImRlbGV0ZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiBvYmplY3QsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZTogZGF0YS52YWx1ZXNbaV1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSwgZXhjZXB0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YS5wcm9wZXJ0aWVzLnNwbGljZShpLCAxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YS52YWx1ZXMuc3BsaWNlKGksIDEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wbGVuLS07XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGEsIG9iamVjdCwgZXhjZXB0KSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIWRhdGEuaGFuZGxlcnMuc2l6ZSB8fCBkYXRhLmZyb3plbikgcmV0dXJuO1xyXG5cclxuICAgICAgICAgICAgICAgIHZhciBwcm9wcywgcHJvcGxlbiwga2V5cyxcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZXMgPSBkYXRhLnZhbHVlcyxcclxuICAgICAgICAgICAgICAgICAgICBkZXNjcyA9IGRhdGEuZGVzY3JpcHRvcnMsXHJcbiAgICAgICAgICAgICAgICAgICAgaSA9IDAsIGlkeCxcclxuICAgICAgICAgICAgICAgICAgICBrZXksIHZhbHVlLFxyXG4gICAgICAgICAgICAgICAgICAgIHByb3RvLCBkZXNjcjtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBJZiB0aGUgb2JqZWN0IGlzbid0IGV4dGVuc2libGUsIHdlIGRvbid0IG5lZWQgdG8gY2hlY2sgZm9yIG5ld1xyXG4gICAgICAgICAgICAgICAgLy8gb3IgZGVsZXRlZCBwcm9wZXJ0aWVzXHJcbiAgICAgICAgICAgICAgICBpZiAoZGF0YS5leHRlbnNpYmxlKSB7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHByb3BzID0gZGF0YS5wcm9wZXJ0aWVzLnNsaWNlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcHJvcGxlbiA9IHByb3BzLmxlbmd0aDtcclxuICAgICAgICAgICAgICAgICAgICBrZXlzID0gZ2V0UHJvcHMob2JqZWN0KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRlc2NzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHdoaWxlIChpIDwga2V5cy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleSA9IGtleXNbaSsrXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkeCA9IGluQXJyYXkocHJvcHMsIGtleSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjciA9IGdldERlc2NyaXB0b3Iob2JqZWN0LCBrZXkpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpZHggPT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkQ2hhbmdlUmVjb3JkKG9iamVjdCwgZGF0YSwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBrZXksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwiYWRkXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdDogb2JqZWN0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgZXhjZXB0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhLnByb3BlcnRpZXMucHVzaChrZXkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlcy5wdXNoKG9iamVjdFtrZXldKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcy5wdXNoKGRlc2NyKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcHNbaWR4XSA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGxlbi0tO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZUNoZWNrKG9iamVjdCwgZGF0YSwgaWR4LCBleGNlcHQsIGRlc2NyKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGlvbkNoZWNrKG9iamVjdCwgcHJvcHMsIHByb3BsZW4sIGRhdGEsIGV4Y2VwdCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIU8uaXNFeHRlbnNpYmxlKG9iamVjdCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEuZXh0ZW5zaWJsZSA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkQ2hhbmdlUmVjb3JkKG9iamVjdCwgZGF0YSwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwicHJldmVudEV4dGVuc2lvbnNcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmplY3Q6IG9iamVjdFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgZXhjZXB0KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhLmZyb3plbiA9IE8uaXNGcm96ZW4ob2JqZWN0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHdoaWxlIChpIDwga2V5cy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleSA9IGtleXNbaSsrXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkeCA9IGluQXJyYXkocHJvcHMsIGtleSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IG9iamVjdFtrZXldO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpZHggPT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkQ2hhbmdlUmVjb3JkKG9iamVjdCwgZGF0YSwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBrZXksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwiYWRkXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdDogb2JqZWN0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgZXhjZXB0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhLnByb3BlcnRpZXMucHVzaChrZXkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlcy5wdXNoKHZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcHNbaWR4XSA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGxlbi0tO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZUNoZWNrKG9iamVjdCwgZGF0YSwgaWR4LCBleGNlcHQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0aW9uQ2hlY2sob2JqZWN0LCBwcm9wcywgcHJvcGxlbiwgZGF0YSwgZXhjZXB0KTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICghZGF0YS5mcm96ZW4pIHtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgdGhlIG9iamVjdCBpcyBub3QgZXh0ZW5zaWJsZSwgYnV0IG5vdCBmcm96ZW4sIHdlIGp1c3QgaGF2ZVxyXG4gICAgICAgICAgICAgICAgICAgIC8vIHRvIGNoZWNrIGZvciB2YWx1ZSBjaGFuZ2VzXHJcbiAgICAgICAgICAgICAgICAgICAgZm9yICg7IGkgPCBwcm9wcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBrZXkgPSBwcm9wc1tpXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlQ2hlY2sob2JqZWN0LCBkYXRhLCBpLCBleGNlcHQsIGdldERlc2NyaXB0b3Iob2JqZWN0LCBrZXkpKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChPLmlzRnJvemVuKG9iamVjdCkpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEuZnJvemVuID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoZ2V0UHJvdG90eXBlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcHJvdG8gPSBnZXRQcm90b3R5cGUob2JqZWN0KTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAocHJvdG8gIT09IGRhdGEucHJvdG8pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWRkQ2hhbmdlUmVjb3JkKG9iamVjdCwgZGF0YSwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJzZXRQcm90b3R5cGVcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IFwiX19wcm90b19fXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmplY3Q6IG9iamVjdCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlOiBkYXRhLnByb3RvXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhLnByb3RvID0gcHJvdG87XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0pKCksXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFNldHMgdXAgdGhlIG1haW4gbG9vcCBmb3Igb2JqZWN0IG9ic2VydmF0aW9uIGFuZCBjaGFuZ2Ugbm90aWZpY2F0aW9uXHJcbiAgICAgICAgICogSXQgc3RvcHMgaWYgbm8gb2JqZWN0IGlzIG9ic2VydmVkLlxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBydW5HbG9iYWxMb29wXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgcnVuR2xvYmFsTG9vcCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICBpZiAob2JzZXJ2ZWQuc2l6ZSkge1xyXG4gICAgICAgICAgICAgICAgb2JzZXJ2ZWQuZm9yRWFjaChwZXJmb3JtUHJvcGVydHlDaGVja3MpO1xyXG4gICAgICAgICAgICAgICAgaGFuZGxlcnMuZm9yRWFjaChkZWxpdmVySGFuZGxlclJlY29yZHMpO1xyXG4gICAgICAgICAgICAgICAgbmV4dEZyYW1lKHJ1bkdsb2JhbExvb3ApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogRGVsaXZlciB0aGUgY2hhbmdlIHJlY29yZHMgcmVsYXRpdmUgdG8gYSBjZXJ0YWluIGhhbmRsZXIsIGFuZCByZXNldHNcclxuICAgICAgICAgKiB0aGUgcmVjb3JkIGxpc3QuXHJcbiAgICAgICAgICogQHBhcmFtIHtIYW5kbGVyRGF0YX0gaGRhdGFcclxuICAgICAgICAgKiBAcGFyYW0ge0hhbmRsZXJ9IGhhbmRsZXJcclxuICAgICAgICAgKi9cclxuICAgICAgICBkZWxpdmVySGFuZGxlclJlY29yZHMgPSBmdW5jdGlvbihoZGF0YSwgaGFuZGxlcikge1xyXG4gICAgICAgICAgICBpZiAoaGRhdGEuY2hhbmdlUmVjb3Jkcy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgIGhhbmRsZXIoaGRhdGEuY2hhbmdlUmVjb3Jkcyk7XHJcbiAgICAgICAgICAgICAgICBoZGF0YS5jaGFuZ2VSZWNvcmRzID0gW107XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBSZXR1cm5zIHRoZSBub3RpZmllciBmb3IgYW4gb2JqZWN0IC0gd2hldGhlciBpdCdzIG9ic2VydmVkIG9yIG5vdFxyXG4gICAgICAgICAqIEBmdW5jdGlvbiByZXRyaWV2ZU5vdGlmaWVyXHJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0RGF0YX0gW2RhdGFdXHJcbiAgICAgICAgICogQHJldHVybnMge05vdGlmaWVyfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHJldHJpZXZlTm90aWZpZXIgPSBmdW5jdGlvbihvYmplY3QsIGRhdGEpIHtcclxuICAgICAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAyKVxyXG4gICAgICAgICAgICAgICAgZGF0YSA9IG9ic2VydmVkLmdldChvYmplY3QpO1xyXG5cclxuICAgICAgICAgICAgLyoqIEB0eXBlIHtOb3RpZmllcn0gKi9cclxuICAgICAgICAgICAgcmV0dXJuIGRhdGEgJiYgZGF0YS5ub3RpZmllciB8fCB7XHJcbiAgICAgICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICAgICAqIEBtZXRob2Qgbm90aWZ5XHJcbiAgICAgICAgICAgICAgICAgKiBAc2VlIGh0dHA6Ly9hcnYuZ2l0aHViLmlvL2VjbWFzY3JpcHQtb2JqZWN0LW9ic2VydmUvI25vdGlmaWVycHJvdG90eXBlLl9ub3RpZnlcclxuICAgICAgICAgICAgICAgICAqIEBtZW1iZXJvZiBOb3RpZmllclxyXG4gICAgICAgICAgICAgICAgICogQHBhcmFtIHtDaGFuZ2VSZWNvcmR9IGNoYW5nZVJlY29yZFxyXG4gICAgICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgICAgICBub3RpZnk6IGZ1bmN0aW9uKGNoYW5nZVJlY29yZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZVJlY29yZC50eXBlOyAvLyBKdXN0IHRvIGNoZWNrIHRoZSBwcm9wZXJ0eSBpcyB0aGVyZS4uLlxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBJZiB0aGVyZSdzIG5vIGRhdGEsIHRoZSBvYmplY3QgaGFzIGJlZW4gdW5vYnNlcnZlZFxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBkYXRhID0gb2JzZXJ2ZWQuZ2V0KG9iamVjdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGEpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlY29yZENvcHkgPSB7IG9iamVjdDogb2JqZWN0IH0sIHByb3A7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAocHJvcCBpbiBjaGFuZ2VSZWNvcmQpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocHJvcCAhPT0gXCJvYmplY3RcIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWNvcmRDb3B5W3Byb3BdID0gY2hhbmdlUmVjb3JkW3Byb3BdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRDaGFuZ2VSZWNvcmQob2JqZWN0LCBkYXRhLCByZWNvcmRDb3B5KTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LFxyXG5cclxuICAgICAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgICAgICogQG1ldGhvZCBwZXJmb3JtQ2hhbmdlXHJcbiAgICAgICAgICAgICAgICAgKiBAc2VlIGh0dHA6Ly9hcnYuZ2l0aHViLmlvL2VjbWFzY3JpcHQtb2JqZWN0LW9ic2VydmUvI25vdGlmaWVycHJvdG90eXBlXy5wZXJmb3JtY2hhbmdlXHJcbiAgICAgICAgICAgICAgICAgKiBAbWVtYmVyb2YgTm90aWZpZXJcclxuICAgICAgICAgICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBjaGFuZ2VUeXBlXHJcbiAgICAgICAgICAgICAgICAgKiBAcGFyYW0ge1BlcmZvcm1lcn0gZnVuYyAgICAgVGhlIHRhc2sgcGVyZm9ybWVyXHJcbiAgICAgICAgICAgICAgICAgKiBAcGFyYW0geyp9IFt0aGlzT2JqXSAgICAgICAgVXNlZCB0byBzZXQgYHRoaXNgIHdoZW4gY2FsbGluZyBmdW5jXHJcbiAgICAgICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgICAgIHBlcmZvcm1DaGFuZ2U6IGZ1bmN0aW9uKGNoYW5nZVR5cGUsIGZ1bmMvKiwgdGhpc09iaiovKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjaGFuZ2VUeXBlICE9PSBcInN0cmluZ1wiKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBub24tc3RyaW5nIGNoYW5nZVR5cGVcIik7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZnVuYyAhPT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHBlcmZvcm0gbm9uLWZ1bmN0aW9uXCIpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBJZiB0aGVyZSdzIG5vIGRhdGEsIHRoZSBvYmplY3QgaGFzIGJlZW4gdW5vYnNlcnZlZFxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBkYXRhID0gb2JzZXJ2ZWQuZ2V0KG9iamVjdCksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3AsIGNoYW5nZVJlY29yZCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gZnVuYy5jYWxsKGFyZ3VtZW50c1syXSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGRhdGEgJiYgcGVyZm9ybVByb3BlcnR5Q2hlY2tzKGRhdGEsIG9iamVjdCwgY2hhbmdlVHlwZSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHRoZXJlJ3Mgbm8gZGF0YSwgdGhlIG9iamVjdCBoYXMgYmVlbiB1bm9ic2VydmVkXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGEgJiYgcmVzdWx0ICYmIHR5cGVvZiByZXN1bHQgPT09IFwib2JqZWN0XCIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2hhbmdlUmVjb3JkID0geyBvYmplY3Q6IG9iamVjdCwgdHlwZTogY2hhbmdlVHlwZSB9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHByb3AgaW4gcmVzdWx0KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByb3AgIT09IFwib2JqZWN0XCIgJiYgcHJvcCAhPT0gXCJ0eXBlXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hhbmdlUmVjb3JkW3Byb3BdID0gcmVzdWx0W3Byb3BdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRDaGFuZ2VSZWNvcmQob2JqZWN0LCBkYXRhLCBjaGFuZ2VSZWNvcmQpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBSZWdpc3RlciAob3IgcmVkZWZpbmVzKSBhbiBoYW5kbGVyIGluIHRoZSBjb2xsZWN0aW9uIGZvciBhIGdpdmVuXHJcbiAgICAgICAgICogb2JqZWN0IGFuZCBhIGdpdmVuIHR5cGUgYWNjZXB0IGxpc3QuXHJcbiAgICAgICAgICogQGZ1bmN0aW9uIHNldEhhbmRsZXJcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XHJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3REYXRhfSBkYXRhXHJcbiAgICAgICAgICogQHBhcmFtIHtIYW5kbGVyfSBoYW5kbGVyXHJcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmdbXX0gYWNjZXB0TGlzdFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHNldEhhbmRsZXIgPSBmdW5jdGlvbihvYmplY3QsIGRhdGEsIGhhbmRsZXIsIGFjY2VwdExpc3QpIHtcclxuICAgICAgICAgICAgdmFyIGhkYXRhID0gaGFuZGxlcnMuZ2V0KGhhbmRsZXIpLCBvZGF0YTtcclxuICAgICAgICAgICAgaWYgKCFoZGF0YSlcclxuICAgICAgICAgICAgICAgIGhhbmRsZXJzLnNldChoYW5kbGVyLCBoZGF0YSA9IHtcclxuICAgICAgICAgICAgICAgICAgICBvYnNlcnZlZDogY3JlYXRlTWFwKCksXHJcbiAgICAgICAgICAgICAgICAgICAgY2hhbmdlUmVjb3JkczogW11cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBoZGF0YS5vYnNlcnZlZC5zZXQob2JqZWN0LCB7XHJcbiAgICAgICAgICAgICAgICBhY2NlcHRMaXN0OiBhY2NlcHRMaXN0LnNsaWNlKCksXHJcbiAgICAgICAgICAgICAgICBkYXRhOiBkYXRhXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBkYXRhLmhhbmRsZXJzLnNldChoYW5kbGVyLCBoZGF0YSk7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQWRkcyBhIGNoYW5nZSByZWNvcmQgaW4gYSBnaXZlbiBPYmplY3REYXRhXHJcbiAgICAgICAgICogQGZ1bmN0aW9uIGFkZENoYW5nZVJlY29yZFxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdERhdGF9IGRhdGFcclxuICAgICAgICAgKiBAcGFyYW0ge0NoYW5nZVJlY29yZH0gY2hhbmdlUmVjb3JkXHJcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IFtleGNlcHRdXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYWRkQ2hhbmdlUmVjb3JkID0gZnVuY3Rpb24ob2JqZWN0LCBkYXRhLCBjaGFuZ2VSZWNvcmQsIGV4Y2VwdCkge1xyXG4gICAgICAgICAgICBkYXRhLmhhbmRsZXJzLmZvckVhY2goZnVuY3Rpb24oaGRhdGEpIHtcclxuICAgICAgICAgICAgICAgIHZhciBhY2NlcHRMaXN0ID0gaGRhdGEub2JzZXJ2ZWQuZ2V0KG9iamVjdCkuYWNjZXB0TGlzdDtcclxuICAgICAgICAgICAgICAgIC8vIElmIGV4Y2VwdCBpcyBkZWZpbmVkLCBOb3RpZmllci5wZXJmb3JtQ2hhbmdlIGhhcyBiZWVuXHJcbiAgICAgICAgICAgICAgICAvLyBjYWxsZWQsIHdpdGggZXhjZXB0IGFzIHRoZSB0eXBlLlxyXG4gICAgICAgICAgICAgICAgLy8gQWxsIHRoZSBoYW5kbGVycyB0aGF0IGFjY2VwdHMgdGhhdCB0eXBlIGFyZSBza2lwcGVkLlxyXG4gICAgICAgICAgICAgICAgaWYgKCh0eXBlb2YgZXhjZXB0ICE9PSBcInN0cmluZ1wiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHx8IGluQXJyYXkoYWNjZXB0TGlzdCwgZXhjZXB0KSA9PT0gLTEpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICYmIGluQXJyYXkoYWNjZXB0TGlzdCwgY2hhbmdlUmVjb3JkLnR5cGUpID4gLTEpXHJcbiAgICAgICAgICAgICAgICAgICAgaGRhdGEuY2hhbmdlUmVjb3Jkcy5wdXNoKGNoYW5nZVJlY29yZCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgb2JzZXJ2ZWQgPSBjcmVhdGVNYXAoKTtcclxuICAgIGhhbmRsZXJzID0gY3JlYXRlTWFwKCk7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAZnVuY3Rpb24gT2JqZWN0Lm9ic2VydmVcclxuICAgICAqIEBzZWUgaHR0cDovL2Fydi5naXRodWIuaW8vZWNtYXNjcmlwdC1vYmplY3Qtb2JzZXJ2ZS8jT2JqZWN0Lm9ic2VydmVcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAqIEBwYXJhbSB7SGFuZGxlcn0gaGFuZGxlclxyXG4gICAgICogQHBhcmFtIHtTdHJpbmdbXX0gW2FjY2VwdExpc3RdXHJcbiAgICAgKiBAdGhyb3dzIHtUeXBlRXJyb3J9XHJcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSAgICAgICAgICAgICAgIFRoZSBvYnNlcnZlZCBvYmplY3RcclxuICAgICAqL1xyXG4gICAgTy5vYnNlcnZlID0gZnVuY3Rpb24gb2JzZXJ2ZShvYmplY3QsIGhhbmRsZXIsIGFjY2VwdExpc3QpIHtcclxuICAgICAgICBpZiAoIW9iamVjdCB8fCB0eXBlb2Ygb2JqZWN0ICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiBvYmplY3QgIT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdC5vYnNlcnZlIGNhbm5vdCBvYnNlcnZlIG5vbi1vYmplY3RcIik7XHJcblxyXG4gICAgICAgIGlmICh0eXBlb2YgaGFuZGxlciAhPT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0Lm9ic2VydmUgY2Fubm90IGRlbGl2ZXIgdG8gbm9uLWZ1bmN0aW9uXCIpO1xyXG5cclxuICAgICAgICBpZiAoTy5pc0Zyb3plbiAmJiBPLmlzRnJvemVuKGhhbmRsZXIpKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0Lm9ic2VydmUgY2Fubm90IGRlbGl2ZXIgdG8gYSBmcm96ZW4gZnVuY3Rpb24gb2JqZWN0XCIpO1xyXG5cclxuICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDIpIHtcclxuICAgICAgICAgICAgaWYgKCFhY2NlcHRMaXN0IHx8IHR5cGVvZiBhY2NlcHRMaXN0ICE9PSBcIm9iamVjdFwiKVxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdC5vYnNlcnZlIGNhbm5vdCB1c2Ugbm9uLW9iamVjdCBhY2NlcHQgbGlzdFwiKTtcclxuICAgICAgICB9IGVsc2UgYWNjZXB0TGlzdCA9IGRlZmF1bHRBY2NlcHRMaXN0O1xyXG5cclxuICAgICAgICBkb09ic2VydmUob2JqZWN0LCBoYW5kbGVyLCBhY2NlcHRMaXN0KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIG9iamVjdDtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAZnVuY3Rpb24gT2JqZWN0LnVub2JzZXJ2ZVxyXG4gICAgICogQHNlZSBodHRwOi8vYXJ2LmdpdGh1Yi5pby9lY21hc2NyaXB0LW9iamVjdC1vYnNlcnZlLyNPYmplY3QudW5vYnNlcnZlXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XHJcbiAgICAgKiBAcGFyYW0ge0hhbmRsZXJ9IGhhbmRsZXJcclxuICAgICAqIEB0aHJvd3Mge1R5cGVFcnJvcn1cclxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9ICAgICAgICAgVGhlIGdpdmVuIG9iamVjdFxyXG4gICAgICovXHJcbiAgICBPLnVub2JzZXJ2ZSA9IGZ1bmN0aW9uIHVub2JzZXJ2ZShvYmplY3QsIGhhbmRsZXIpIHtcclxuICAgICAgICBpZiAob2JqZWN0ID09PSBudWxsIHx8IHR5cGVvZiBvYmplY3QgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIG9iamVjdCAhPT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0LnVub2JzZXJ2ZSBjYW5ub3QgdW5vYnNlcnZlIG5vbi1vYmplY3RcIik7XHJcblxyXG4gICAgICAgIGlmICh0eXBlb2YgaGFuZGxlciAhPT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0LnVub2JzZXJ2ZSBjYW5ub3QgZGVsaXZlciB0byBub24tZnVuY3Rpb25cIik7XHJcblxyXG4gICAgICAgIHZhciBoZGF0YSA9IGhhbmRsZXJzLmdldChoYW5kbGVyKSwgb2RhdGE7XHJcblxyXG4gICAgICAgIGlmIChoZGF0YSAmJiAob2RhdGEgPSBoZGF0YS5vYnNlcnZlZC5nZXQob2JqZWN0KSkpIHtcclxuICAgICAgICAgICAgaGRhdGEub2JzZXJ2ZWQuZm9yRWFjaChmdW5jdGlvbihvZGF0YSwgb2JqZWN0KSB7XHJcbiAgICAgICAgICAgICAgICBwZXJmb3JtUHJvcGVydHlDaGVja3Mob2RhdGEuZGF0YSwgb2JqZWN0KTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIG5leHRGcmFtZShmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIGRlbGl2ZXJIYW5kbGVyUmVjb3JkcyhoZGF0YSwgaGFuZGxlcik7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgLy8gSW4gRmlyZWZveCAxMy0xOCwgc2l6ZSBpcyBhIGZ1bmN0aW9uLCBidXQgY3JlYXRlTWFwIHNob3VsZCBmYWxsXHJcbiAgICAgICAgICAgIC8vIGJhY2sgdG8gdGhlIHNoaW0gZm9yIHRob3NlIHZlcnNpb25zXHJcbiAgICAgICAgICAgIGlmIChoZGF0YS5vYnNlcnZlZC5zaXplID09PSAxICYmIGhkYXRhLm9ic2VydmVkLmhhcyhvYmplY3QpKVxyXG4gICAgICAgICAgICAgICAgaGFuZGxlcnNbXCJkZWxldGVcIl0oaGFuZGxlcik7XHJcbiAgICAgICAgICAgIGVsc2UgaGRhdGEub2JzZXJ2ZWRbXCJkZWxldGVcIl0ob2JqZWN0KTtcclxuXHJcbiAgICAgICAgICAgIGlmIChvZGF0YS5kYXRhLmhhbmRsZXJzLnNpemUgPT09IDEpXHJcbiAgICAgICAgICAgICAgICBvYnNlcnZlZFtcImRlbGV0ZVwiXShvYmplY3QpO1xyXG4gICAgICAgICAgICBlbHNlIG9kYXRhLmRhdGEuaGFuZGxlcnNbXCJkZWxldGVcIl0oaGFuZGxlcik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gb2JqZWN0O1xyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEBmdW5jdGlvbiBPYmplY3QuZ2V0Tm90aWZpZXJcclxuICAgICAqIEBzZWUgaHR0cDovL2Fydi5naXRodWIuaW8vZWNtYXNjcmlwdC1vYmplY3Qtb2JzZXJ2ZS8jR2V0Tm90aWZpZXJcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAqIEB0aHJvd3Mge1R5cGVFcnJvcn1cclxuICAgICAqIEByZXR1cm5zIHtOb3RpZmllcn1cclxuICAgICAqL1xyXG4gICAgTy5nZXROb3RpZmllciA9IGZ1bmN0aW9uIGdldE5vdGlmaWVyKG9iamVjdCkge1xyXG4gICAgICAgIGlmIChvYmplY3QgPT09IG51bGwgfHwgdHlwZW9mIG9iamVjdCAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2Ygb2JqZWN0ICE9PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3QuZ2V0Tm90aWZpZXIgY2Fubm90IGdldE5vdGlmaWVyIG5vbi1vYmplY3RcIik7XHJcblxyXG4gICAgICAgIGlmIChPLmlzRnJvemVuICYmIE8uaXNGcm96ZW4ob2JqZWN0KSkgcmV0dXJuIG51bGw7XHJcblxyXG4gICAgICAgIHJldHVybiByZXRyaWV2ZU5vdGlmaWVyKG9iamVjdCk7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQGZ1bmN0aW9uIE9iamVjdC5kZWxpdmVyQ2hhbmdlUmVjb3Jkc1xyXG4gICAgICogQHNlZSBodHRwOi8vYXJ2LmdpdGh1Yi5pby9lY21hc2NyaXB0LW9iamVjdC1vYnNlcnZlLyNPYmplY3QuZGVsaXZlckNoYW5nZVJlY29yZHNcclxuICAgICAqIEBzZWUgaHR0cDovL2Fydi5naXRodWIuaW8vZWNtYXNjcmlwdC1vYmplY3Qtb2JzZXJ2ZS8jRGVsaXZlckNoYW5nZVJlY29yZHNcclxuICAgICAqIEBwYXJhbSB7SGFuZGxlcn0gaGFuZGxlclxyXG4gICAgICogQHRocm93cyB7VHlwZUVycm9yfVxyXG4gICAgICovXHJcbiAgICBPLmRlbGl2ZXJDaGFuZ2VSZWNvcmRzID0gZnVuY3Rpb24gZGVsaXZlckNoYW5nZVJlY29yZHMoaGFuZGxlcikge1xyXG4gICAgICAgIGlmICh0eXBlb2YgaGFuZGxlciAhPT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzIGNhbm5vdCBkZWxpdmVyIHRvIG5vbi1mdW5jdGlvblwiKTtcclxuXHJcbiAgICAgICAgdmFyIGhkYXRhID0gaGFuZGxlcnMuZ2V0KGhhbmRsZXIpO1xyXG4gICAgICAgIGlmIChoZGF0YSkge1xyXG4gICAgICAgICAgICBoZGF0YS5vYnNlcnZlZC5mb3JFYWNoKGZ1bmN0aW9uKG9kYXRhLCBvYmplY3QpIHtcclxuICAgICAgICAgICAgICAgIHBlcmZvcm1Qcm9wZXJ0eUNoZWNrcyhvZGF0YS5kYXRhLCBvYmplY3QpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgZGVsaXZlckhhbmRsZXJSZWNvcmRzKGhkYXRhLCBoYW5kbGVyKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxufSkoT2JqZWN0LCBBcnJheSwgdGhpcyk7IiwidmFyIHRlbXBsYXRpbmcgPSByZXF1aXJlKFwiZHJvb3B5LXRlbXBsYXRpbmdcIik7XHJcblxyXG52YXIgQXJyYXlCaW5kaW5nID0gZnVuY3Rpb24oZWxlbWVudCwgZnVsbFByb3BlcnR5KSB7XHJcblx0dGhpcy5lbGVtZW50ID0gZWxlbWVudDtcclxuXHR0aGlzLm9yaWdpbmFsID0gZWxlbWVudC5pbm5lckhUTUw7XHJcblx0dGhpcy5mdWxsUHJvcGVydHkgPSBmdWxsUHJvcGVydHk7XHJcbn07XHJcblxyXG5BcnJheUJpbmRpbmcucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKHNjb3BlKSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cdHZhciBhcnJheUh0bWwgPSBcIlwiO1xyXG5cdHZhciBhcnJheSA9IHRlbXBsYXRpbmcuZ2V0T2JqZWN0VmFsdWUoc2NvcGUsIHNlbGYuZnVsbFByb3BlcnR5KTtcclxuXHJcblx0aWYgKGFycmF5ICYmIEFycmF5LmlzQXJyYXkoYXJyYXkpKSB7XHJcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdGFycmF5SHRtbCArPSB0ZW1wbGF0aW5nLnBvcHVsYXRlVGVtcGxhdGUoc2VsZi5vcmlnaW5hbCwgYXJyYXlbaV0sIHRlbXBsYXRpbmcuRWFjaC5yZWdFeHApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRzZWxmLmVsZW1lbnQuaW5uZXJIVE1MID0gYXJyYXlIdG1sO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBBcnJheUJpbmRpbmc7IiwidmFyIHRlbXBsYXRpbmcgPSByZXF1aXJlKFwiZHJvb3B5LXRlbXBsYXRpbmdcIik7XHJcbnZhciBOb2RlQmluZGluZyA9IHJlcXVpcmUoXCIuL25vZGVCaW5kaW5nXCIpO1xyXG52YXIgQXJyYXlCaW5kaW5nID0gcmVxdWlyZShcIi4vYXJyYXlCaW5kaW5nXCIpO1xyXG5cclxudmFyIERyb29weUJpbmRpbmcgPSBmdW5jdGlvbihjb250YWluZXJJZCwgbW9kZWwsIHNob3VsZEluaXQpIHtcclxuXHR0aGlzLm1vZGVsID0gbW9kZWw7XHJcblx0dGhpcy5jb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChjb250YWluZXJJZCk7XHJcblxyXG5cdC8vR2V0IGFsbCBiaW5kaW5nc1xyXG5cdHRoaXMuYmluZGluZ3MgPSB0aGlzLmdldEJpbmRpbmdzKHRoaXMuY29udGFpbmVyKTtcclxuXHJcblx0aWYgKHNob3VsZEluaXQgIT09IGZhbHNlKSB7XHJcblx0XHR0aGlzLmluaXQoKTtcclxuXHR9XHJcbn07XHJcblxyXG5Ecm9vcHlCaW5kaW5nLnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24oKSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cdHNlbGYudXBkYXRlQmluZGluZ3MoKTtcclxuXHRzZWxmLnJlY3Vyc2l2ZU9ic2VydmUoc2VsZi5tb2RlbCwgXCJcIiwgZnVuY3Rpb24oY2hhbmdlcywgcHJvcENoYWluKSB7XHJcblx0XHRzZWxmLmhhbmRsZU9iamVjdENoYW5nZShjaGFuZ2VzLCBwcm9wQ2hhaW4pO1xyXG5cdH0pO1xyXG59O1xyXG5cclxuRHJvb3B5QmluZGluZy5wcm90b3R5cGUucmVjdXJzaXZlT2JzZXJ2ZSA9IGZ1bmN0aW9uKG9iaiwgcHJvcENoYWluLCBjYWxsYmFjaykge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHQvLyBNYWtlIHN1cmUgaXRzIGFuIGFycmF5IG9yIG9iamVjdFxyXG5cdGlmICghQXJyYXkuaXNBcnJheShvYmopICYmIHR5cGVvZiBvYmogIT09IFwib2JqZWN0XCIpIHJldHVybjtcclxuXHJcblx0aWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xyXG5cdFx0aWYgKEFycmF5Lm9ic2VydmUpIHtcclxuXHRcdFx0QXJyYXkub2JzZXJ2ZShvYmosIGZ1bmN0aW9uKGNoYW5nZXMpIHtcclxuXHRcdFx0XHRzZWxmLmhhbmRsZUFycmF5Q2hhbmdlKGNoYW5nZXMsIHByb3BDaGFpbik7XHJcblx0XHRcdH0pO1x0XHRcdFxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0T2JqZWN0Lm9ic2VydmUob2JqLCBmdW5jdGlvbihjaGFuZ2VzKSB7XHJcblx0XHRcdFx0c2VsZi5oYW5kbGVBcnJheUNoYW5nZShjaGFuZ2VzLCBwcm9wQ2hhaW4pO1xyXG5cdFx0XHR9KTtcdFxyXG5cdFx0fVxyXG5cdFx0Ly8gUmVjdXJzaXZlbHkgb2JzZXJ2ZSBhbnkgYXJyYXkgaXRlbXNcclxuXHRcdG9iai5mb3JFYWNoKGZ1bmN0aW9uKGFycmF5SXRlbSwgaSl7XHJcblx0XHRcdHNlbGYucmVjdXJzaXZlT2JzZXJ2ZShhcnJheUl0ZW0sIFwiXCIsIGZ1bmN0aW9uKGNoYW5nZXMpIHsgXHJcblx0XHRcdFx0c2VsZi5oYW5kbGVBcnJheUNoYW5nZS5jYWxsKHNlbGYsIGNoYW5nZXMsIHByb3BDaGFpbik7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblxyXG5cdH0gZWxzZSB7XHJcblx0XHRPYmplY3Qub2JzZXJ2ZShvYmosIGZ1bmN0aW9uKGNoYW5nZXMpIHtcclxuXHRcdFx0Y2FsbGJhY2soY2hhbmdlcywgcHJvcENoYWluKTtcclxuXHRcdH0pO1xyXG5cdFx0XHJcblx0XHQvLyBSZWN1cnNpdmVseSBvYnNlcnZlIGFueSBjaGlsZCBvYmplY3RzXHJcblx0XHRPYmplY3Qua2V5cyhvYmopLmZvckVhY2goZnVuY3Rpb24ocHJvcE5hbWUpIHtcclxuXHRcdFx0dmFyIG5ld1Byb3BDaGFpbiA9IHByb3BDaGFpbjtcclxuXHRcdFx0aWYgKG5ld1Byb3BDaGFpbikge1xyXG5cdFx0XHRcdG5ld1Byb3BDaGFpbiArPSBcIi5cIiArIHByb3BOYW1lO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdG5ld1Byb3BDaGFpbiA9IHByb3BOYW1lO1xyXG5cdFx0XHR9XHJcblx0XHRcdHNlbGYucmVjdXJzaXZlT2JzZXJ2ZShvYmpbcHJvcE5hbWVdLCBuZXdQcm9wQ2hhaW4sIGNhbGxiYWNrKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHRcclxufTtcclxuXHJcbkRyb29weUJpbmRpbmcucHJvdG90eXBlLmhhbmRsZUFycmF5Q2hhbmdlID0gZnVuY3Rpb24oY2hhbmdlcywgcHJvcENoYWluKSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuXHQvLyBSZS1vYnNlcnZlIGFueSBuZXcgb2JqZWN0c1xyXG5cdGNoYW5nZXMuZm9yRWFjaChmdW5jdGlvbihjaGFuZ2Upe1xyXG5cdFx0Ly9JZiBpdHMgYW4gYXJyYXkgY2hhbmdlLCBhbmQgYW4gdXBkYXRlLCBpdHMgYSBuZXcgaW5kZXggYXNzaWdubWVudCBzbyByZS1vYnNlcnZlXHJcblx0XHRpZiAoQXJyYXkuaXNBcnJheShjaGFuZ2Uub2JqZWN0KSAmJiBjaGFuZ2UudHlwZSA9PT0gXCJ1cGRhdGVcIikge1xyXG5cdFx0XHRzZWxmLnJlY3Vyc2l2ZU9ic2VydmUoY2hhbmdlLm9iamVjdFtjaGFuZ2UubmFtZV0sIFwiXCIsIGZ1bmN0aW9uKGNoYW5nZXMpIHsgXHJcblx0XHRcdFx0c2VsZi5oYW5kbGVBcnJheUNoYW5nZS5jYWxsKHNlbGYsIGNoYW5nZXMsIHByb3BDaGFpbik7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSBcclxuXHRcdC8vIElmIGl0cyBhIHB1c2ggb3IgYSBwb3AgaXQgd2lsbCBjb21lIHRocm91Z2ggYXMgc3BsaWNlXHJcblx0XHRlbHNlIGlmIChBcnJheS5pc0FycmF5KGNoYW5nZS5vYmplY3QpICYmIGNoYW5nZS50eXBlID09PSBcInNwbGljZVwiKSB7XHJcblx0XHRcdC8vIElmIGl0cyBhIHB1c2gsIGFkZGVkQ291bnQgd2lsbCBiZSAxXHJcblx0XHRcdGlmIChjaGFuZ2UuYWRkZWRDb3VudCA+IDApIHtcclxuXHRcdFx0XHQvLyBzdGFydCBvYnNlcnZpbmcgdGhlIG5ldyBhcnJheSBpdGVtXHJcblx0XHRcdFx0c2VsZi5yZWN1cnNpdmVPYnNlcnZlKGNoYW5nZS5vYmplY3RbY2hhbmdlLmluZGV4XSwgXCJcIiwgZnVuY3Rpb24oY2hhbmdlcykgeyBcclxuXHRcdFx0XHRcdHNlbGYuaGFuZGxlQXJyYXlDaGFuZ2UuY2FsbChzZWxmLCBjaGFuZ2VzLCBwcm9wQ2hhaW4pO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vIElmIGl0cyBhIHBvcCB3ZSByZWFsbHkgZG9uJ3QgY2FyZSBoZXJlIGJlY2F1c2UgdGhlcmUgaXMgbm90aGluZyB0byByZS1vYnNlcnZlXHJcblx0XHR9XHJcblx0fSk7XHJcblx0Ly8gUmVyZW5kZXIgZGF0YS1lYWNoIGJpbmRpbmdzIHRoYXQgYXJlIHRpZWQgdG8gdGhlIGFycmF5XHJcblx0c2VsZi5iaW5kaW5ncy5mb3JFYWNoKGZ1bmN0aW9uKGJpbmRpbmcpIHtcclxuXHRcdGlmIChiaW5kaW5nLmZ1bGxQcm9wZXJ0eSA9PT0gcHJvcENoYWluKSB7XHJcblx0XHRcdGJpbmRpbmcudXBkYXRlKHNlbGYubW9kZWwpO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG59O1xyXG5cclxuRHJvb3B5QmluZGluZy5wcm90b3R5cGUuaGFuZGxlT2JqZWN0Q2hhbmdlID0gZnVuY3Rpb24oY2hhbmdlcywgcHJvcENoYWluKSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cdGNoYW5nZXMuZm9yRWFjaChmdW5jdGlvbihjaGFuZ2UpIHtcclxuXHRcdC8vIEdldCB0aGUgcHJvcGVydHkgY2hhaW4gc3RyaW5nIHRvIHRpZSBiYWNrIHRvIFVJIHBsYWNlaG9sZGVyXHJcblx0XHR2YXIgY2hhbmdlZFByb3AgPSBjaGFuZ2UubmFtZTtcclxuXHRcdGlmIChwcm9wQ2hhaW4pIHtcclxuXHRcdFx0Y2hhbmdlZFByb3AgPSBwcm9wQ2hhaW4gKyBcIi5cIiArIGNoYW5nZS5uYW1lO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIENoZWNrIGVhY2ggYmluZGluZyB0byBzZWUgaWYgaXQgY2FyZXMsIHVwZGF0ZSBpZiBpdCBkb2VzXHJcblx0XHRzZWxmLmJpbmRpbmdzLmZvckVhY2goZnVuY3Rpb24oYmluZGluZykge1xyXG5cdFx0XHQvLyBzdGFydHMgd2l0aCBwcm9wIGNoYWluIHRvIGFsbG93IHdob2xlIGNoaWxkIG9iamVjdCB0byBiZSB1cGRhdGVkXHJcblx0XHRcdGlmIChiaW5kaW5nLmZ1bGxQcm9wZXJ0eS5pbmRleE9mKGNoYW5nZWRQcm9wKSA9PT0gMCkge1xyXG5cdFx0XHRcdGJpbmRpbmcudXBkYXRlKHNlbGYubW9kZWwpO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHJcblx0XHQvLyBJZiBvYmplY3QgZ2V0cyBvdmVyd3JpdHRlbiwgbmVlZCB0byByZS1vYnNlcnZlIGl0XHJcblx0XHRpZiAoY2hhbmdlLnR5cGUgPT09IFwidXBkYXRlXCIpIHtcclxuXHRcdFx0c2VsZi5yZWN1cnNpdmVPYnNlcnZlKGNoYW5nZS5vYmplY3RbY2hhbmdlLm5hbWVdLCBjaGFuZ2VkUHJvcCwgZnVuY3Rpb24oY2hhbmdlcywgcHJvcENoYWluKSB7XHJcblx0XHRcdFx0c2VsZi5oYW5kbGVPYmplY3RDaGFuZ2UoY2hhbmdlcywgcHJvcENoYWluKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9XHJcblx0fSk7XHJcbn07XHJcblxyXG5Ecm9vcHlCaW5kaW5nLnByb3RvdHlwZS51cGRhdGVCaW5kaW5ncyA9IGZ1bmN0aW9uKCkge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHRzZWxmLmJpbmRpbmdzLmZvckVhY2goZnVuY3Rpb24oYmluZGluZykge1xyXG5cdFx0YmluZGluZy51cGRhdGUoc2VsZi5tb2RlbCk7XHJcblx0fSk7XHJcbn07XHJcblxyXG5Ecm9vcHlCaW5kaW5nLnByb3RvdHlwZS51cGRhdGVNb2RlbFByb3BlcnR5ID0gZnVuY3Rpb24oZnVsbFByb3BlcnR5LCBuZXdWYWx1ZSkge1xyXG5cdC8vc3RhcnQgd2l0aCB0aGUgbW9kZWxcclxuXHR2YXIgcHJvcGVydHlDaGFpbiA9IGZ1bGxQcm9wZXJ0eS5zcGxpdCgnLicpO1xyXG5cdHZhciBwYXJlbnRPYmogPSB0aGlzLm1vZGVsO1xyXG5cdHZhciBwcm9wZXJ0eSA9IGZ1bGxQcm9wZXJ0eTtcclxuXHQvL3RyYXZlcnNlIHRoZSBwcm9wZXJ0eSBjaGFpbiwgZXhjZXB0IGZvciBsYXN0IG9uZVxyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcGVydHlDaGFpbi5sZW5ndGggLSAxOyBpKyspIHtcclxuXHRcdGlmIChwYXJlbnRPYmpbcHJvcGVydHlDaGFpbltpXV0gIT0gbnVsbCkge1xyXG5cdFx0XHRwcm9wZXJ0eSA9IHByb3BlcnR5Q2hhaW5baV07XHJcblx0XHRcdHBhcmVudE9iaiA9IHBhcmVudE9ialtwcm9wZXJ0eV07XHJcblx0XHR9IFxyXG5cdH1cclxuXHQvL2lmIGl0cyBhbiB1bmRlcnNjb3JlLCBpdHMgcmVmZXJlbmNpbmcgdGhlIG1vZGVsIHNjb3BlXHJcblx0aWYoZnVsbFByb3BlcnR5ID09PSBcIl9cIikge1xyXG5cdFx0cGFyZW50T2JqID0gbmV3VmFsdWU7XHJcblx0fSBlbHNlIHtcclxuXHRcdHByb3BlcnR5ID0gcHJvcGVydHlDaGFpbltwcm9wZXJ0eUNoYWluLmxlbmd0aCAtIDFdO1xyXG5cdFx0cGFyZW50T2JqW3Byb3BlcnR5XSA9IG5ld1ZhbHVlO1xyXG5cdH1cclxufTtcclxuXHJcbkRyb29weUJpbmRpbmcucHJvdG90eXBlLnVwZGF0ZU1vZGVsID0gZnVuY3Rpb24obmV3TW9kZWwpIHtcclxuXHR0aGlzLm1vZGVsID0gbmV3TW9kZWw7XHJcblx0dGhpcy5pbml0KCk7XHJcbn07XHJcblxyXG5Ecm9vcHlCaW5kaW5nLnByb3RvdHlwZS5nZXRCaW5kaW5ncyA9IGZ1bmN0aW9uKGVsZW1lbnQpIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblx0dmFyIGJpbmRpbmdzID0gW107XHJcblx0dmFyIHBsYWNlaG9sZGVycyA9IFtdO1xyXG5cdHZhciBpID0gMDtcclxuXHQvLyAxLiBMb29rIGZvciBhdHRyaWJ1dGUgYmluZGluZ3MgYW5kIGFycmF5IGJpbmRpbmdzIG9uIHRoZSBjdXJyZW50IGVsZW1lbnRcclxuXHRpZiAoZWxlbWVudC5hdHRyaWJ1dGVzKSB7XHJcblx0XHRmb3IgKGkgPSAwOyBpIDwgZWxlbWVudC5hdHRyaWJ1dGVzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdGlmIChlbGVtZW50LmF0dHJpYnV0ZXNbaV0ubm9kZU5hbWUgPT09IFwiZGF0YS1lYWNoXCIpIHtcclxuXHRcdFx0XHRiaW5kaW5ncy5wdXNoKG5ldyBBcnJheUJpbmRpbmcoZWxlbWVudCwgZWxlbWVudC5hdHRyaWJ1dGVzW2ldLm5vZGVWYWx1ZSkpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHZhciBhdHRyaWJ1dGVCaW5kaW5ncyA9IHRlbXBsYXRpbmcuZ2V0UGxhY2VIb2xkZXJzKGVsZW1lbnQuYXR0cmlidXRlc1tpXS5ub2RlVmFsdWUpXHJcblx0XHRcdFx0XHQubWFwKGZ1bmN0aW9uKHBsYWNlaG9sZGVyKSB7XHJcblx0XHRcdFx0XHRcdHZhciBiaW5kaW5nID0gbmV3IE5vZGVCaW5kaW5nKGVsZW1lbnQuYXR0cmlidXRlc1tpXSwgcGxhY2Vob2xkZXIsIGVsZW1lbnQpO1xyXG5cdFx0XHRcdFx0XHRiaW5kaW5nLm9uKFwiaW5wdXQtY2hhbmdlXCIsIHNlbGYudXBkYXRlTW9kZWxQcm9wZXJ0eS5iaW5kKHNlbGYpKTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIGJpbmRpbmc7XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHRiaW5kaW5ncyA9IGJpbmRpbmdzLmNvbmNhdChhdHRyaWJ1dGVCaW5kaW5ncyk7XHRcdFx0XHRcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHQvLyAyLmEgSWYgdGhlIGVsZW1lbnQgaGFzIGNoaWxkcmVuLCBpdCB3b24ndCBoYXZlIGEgdGV4dCBiaW5kaW5nLiBSZWN1cnNlIG9uIGNoaWxkcmVuXHJcblx0aWYgKGVsZW1lbnQuY2hpbGROb2RlcyAmJiBlbGVtZW50LmNoaWxkTm9kZXMubGVuZ3RoKSB7XHJcblx0XHQvL3JlY3Vyc2l2ZSBjYWxsIGZvciBlYWNoIGNoaWxkbm9kZVxyXG5cdFx0Zm9yIChpID0gMDsgaSA8IGVsZW1lbnQuY2hpbGROb2Rlcy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRiaW5kaW5ncyA9IGJpbmRpbmdzLmNvbmNhdChzZWxmLmdldEJpbmRpbmdzKGVsZW1lbnQuY2hpbGROb2Rlc1tpXSkpO1xyXG5cdFx0fVxyXG5cdH0gZWxzZSB7XHJcblx0XHQvLyAyLmIgVGhlIGVsZW1lbnQgZG9lc24ndCBoYXZlIGNoaWxkcmVuIHNvIGxvb2sgZm9yIGEgdGV4dCBiaW5kaW5nXHJcblx0XHRwbGFjZWhvbGRlcnMgPSB0ZW1wbGF0aW5nLmdldFBsYWNlSG9sZGVycyhlbGVtZW50LnRleHRDb250ZW50KTtcclxuXHRcdHZhciB0ZXh0QmluZGluZ3MgPSBwbGFjZWhvbGRlcnMubWFwKGZ1bmN0aW9uKHBsYWNlaG9sZGVyKSB7XHJcblx0XHRcdHJldHVybiBuZXcgTm9kZUJpbmRpbmcoZWxlbWVudCwgcGxhY2Vob2xkZXIpO1xyXG5cdFx0fSk7XHJcblx0XHRiaW5kaW5ncyA9IGJpbmRpbmdzLmNvbmNhdCh0ZXh0QmluZGluZ3MpO1xyXG5cdH1cclxuXHRyZXR1cm4gYmluZGluZ3M7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IERyb29weUJpbmRpbmc7IiwidmFyIHRlbXBsYXRpbmcgPSByZXF1aXJlKFwiZHJvb3B5LXRlbXBsYXRpbmdcIik7XHJcbnZhciBFdmVudGFibGUgPSByZXF1aXJlKFwiZHJvb3B5LWV2ZW50c1wiKTtcclxuXHJcbnZhciBOb2RlQmluZGluZyA9IGZ1bmN0aW9uKG5vZGUsIHBsYWNlaG9sZGVyLCBlbGVtZW50KSB7XHJcblx0RXZlbnRhYmxlLmNhbGwodGhpcyk7XHJcblx0dGhpcy5ub2RlID0gbm9kZTtcclxuXHR0aGlzLm9yaWdpbmFsID0gbm9kZS5ub2RlVmFsdWU7XHJcblx0dGhpcy5yYXcgPSBwbGFjZWhvbGRlcjtcclxuXHR0aGlzLmZ1bGxQcm9wZXJ0eSA9IHRoaXMucmF3LnNsaWNlKDIsIHRoaXMucmF3Lmxlbmd0aCAtIDIpO1xyXG5cdC8vaWYgbm8gZWxlbWVudCB3YXMgcGFzc2VkIGluLCBpdCBpcyBhIHRleHQgYmluZGluZywgb3RoZXJ3aXNlIGF0dHJpYnV0ZVxyXG5cdHRoaXMuZWxlbWVudCA9IGVsZW1lbnQgfHwgbm9kZTsgXHJcblx0dGhpcy5zZXR1cFR3b1dheSgpO1xyXG59O1xyXG5cclxuTm9kZUJpbmRpbmcucHJvdG90eXBlID0gbmV3IEV2ZW50YWJsZSgpO1xyXG5cclxuTm9kZUJpbmRpbmcucHJvdG90eXBlLnNldHVwVHdvV2F5ID0gZnVuY3Rpb24oKSB7XHJcblx0aWYgKHRoaXMubm9kZS5ub2RlTmFtZSA9PT0gXCJ2YWx1ZVwiICYmIHRoaXMuZWxlbWVudCkge1xyXG5cdFx0aWYgKHRoaXMuZWxlbWVudC50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09IFwiaW5wdXRcIikge1xyXG5cdFx0XHR0aGlzLmVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImlucHV0XCIsIHRoaXMub25JbnB1dENoYW5nZS5iaW5kKHRoaXMpKTtcclxuXHRcdH1cclxuXHRcdGlmICh0aGlzLmVsZW1lbnQudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSBcInNlbGVjdFwiKSB7XHJcblx0XHRcdHRoaXMuZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsIHRoaXMub25JbnB1dENoYW5nZS5iaW5kKHRoaXMpKTtcclxuXHRcdH1cclxuXHR9XHJcbn07XHJcblxyXG5Ob2RlQmluZGluZy5wcm90b3R5cGUub25JbnB1dENoYW5nZSA9IGZ1bmN0aW9uKCkge1xyXG5cdC8vY2FsbGVkIHdpdGggYmluZCwgc28gJ3RoaXMnIGlzIGFjdHVhbGx5IHRoaXNcclxuXHR0aGlzLnRyaWdnZXIoXCJpbnB1dC1jaGFuZ2VcIiwgdGhpcy5mdWxsUHJvcGVydHksIHRoaXMuZWxlbWVudC52YWx1ZSApO1xyXG59O1xyXG5cclxuTm9kZUJpbmRpbmcucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKG1vZGVsKSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cdHZhciBodG1sID0gdGVtcGxhdGluZy5yZW5kZXJUZW1wbGF0ZShzZWxmLm9yaWdpbmFsLCBtb2RlbCk7XHJcblx0c2VsZi5ub2RlLm5vZGVWYWx1ZSA9IGh0bWw7XHJcblx0aWYgKHNlbGYubm9kZS5ub2RlTmFtZSA9PT0gXCJ2YWx1ZVwiICYmIHNlbGYuZWxlbWVudCkge1xyXG5cdFx0c2VsZi5lbGVtZW50LnZhbHVlID0gaHRtbDtcclxuXHR9XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IE5vZGVCaW5kaW5nOyJdfQ==
