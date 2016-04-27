(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/* Native method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * Creates a function that invokes `func` with the `this` binding of the
 * created function and arguments from `start` and beyond provided as an array.
 *
 * **Note:** This method is based on the [rest parameter](https://developer.mozilla.org/Web/JavaScript/Reference/Functions/rest_parameters).
 *
 * @static
 * @memberOf _
 * @category Function
 * @param {Function} func The function to apply a rest parameter to.
 * @param {number} [start=func.length-1] The start position of the rest parameter.
 * @returns {Function} Returns the new function.
 * @example
 *
 * var say = _.restParam(function(what, names) {
 *   return what + ' ' + _.initial(names).join(', ') +
 *     (_.size(names) > 1 ? ', & ' : '') + _.last(names);
 * });
 *
 * say('hello', 'fred', 'barney', 'pebbles');
 * // => 'hello fred, barney, & pebbles'
 */
function restParam(func, start) {
  if (typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  start = nativeMax(start === undefined ? (func.length - 1) : (+start || 0), 0);
  return function() {
    var args = arguments,
        index = -1,
        length = nativeMax(args.length - start, 0),
        rest = Array(length);

    while (++index < length) {
      rest[index] = args[start + index];
    }
    switch (start) {
      case 0: return func.call(this, rest);
      case 1: return func.call(this, args[0], rest);
      case 2: return func.call(this, args[0], args[1], rest);
    }
    var otherArgs = Array(start + 1);
    index = -1;
    while (++index < start) {
      otherArgs[index] = args[index];
    }
    otherArgs[start] = rest;
    return func.apply(this, otherArgs);
  };
}

module.exports = restParam;

},{}],3:[function(require,module,exports){
/**
 * Used by `_.defaults` to customize its `_.assign` use.
 *
 * @private
 * @param {*} objectValue The destination object property value.
 * @param {*} sourceValue The source object property value.
 * @returns {*} Returns the value to assign to the destination object.
 */
function assignDefaults(objectValue, sourceValue) {
  return objectValue === undefined ? sourceValue : objectValue;
}

module.exports = assignDefaults;

},{}],4:[function(require,module,exports){
var keys = require('../object/keys');

/**
 * A specialized version of `_.assign` for customizing assigned values without
 * support for argument juggling, multiple sources, and `this` binding `customizer`
 * functions.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @param {Function} customizer The function to customize assigned values.
 * @returns {Object} Returns `object`.
 */
function assignWith(object, source, customizer) {
  var index = -1,
      props = keys(source),
      length = props.length;

  while (++index < length) {
    var key = props[index],
        value = object[key],
        result = customizer(value, source[key], key, object, source);

    if ((result === result ? (result !== value) : (value === value)) ||
        (value === undefined && !(key in object))) {
      object[key] = result;
    }
  }
  return object;
}

module.exports = assignWith;

},{"../object/keys":28}],5:[function(require,module,exports){
var baseCopy = require('./baseCopy'),
    keys = require('../object/keys');

/**
 * The base implementation of `_.assign` without support for argument juggling,
 * multiple sources, and `customizer` functions.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @returns {Object} Returns `object`.
 */
function baseAssign(object, source) {
  return source == null
    ? object
    : baseCopy(source, keys(source), object);
}

module.exports = baseAssign;

},{"../object/keys":28,"./baseCopy":6}],6:[function(require,module,exports){
/**
 * Copies properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property names to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @returns {Object} Returns `object`.
 */
function baseCopy(source, props, object) {
  object || (object = {});

  var index = -1,
      length = props.length;

  while (++index < length) {
    var key = props[index];
    object[key] = source[key];
  }
  return object;
}

module.exports = baseCopy;

},{}],7:[function(require,module,exports){
/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

module.exports = baseProperty;

},{}],8:[function(require,module,exports){
var identity = require('../utility/identity');

/**
 * A specialized version of `baseCallback` which only supports `this` binding
 * and specifying the number of arguments to provide to `func`.
 *
 * @private
 * @param {Function} func The function to bind.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {number} [argCount] The number of arguments to provide to `func`.
 * @returns {Function} Returns the callback.
 */
function bindCallback(func, thisArg, argCount) {
  if (typeof func != 'function') {
    return identity;
  }
  if (thisArg === undefined) {
    return func;
  }
  switch (argCount) {
    case 1: return function(value) {
      return func.call(thisArg, value);
    };
    case 3: return function(value, index, collection) {
      return func.call(thisArg, value, index, collection);
    };
    case 4: return function(accumulator, value, index, collection) {
      return func.call(thisArg, accumulator, value, index, collection);
    };
    case 5: return function(value, other, key, object, source) {
      return func.call(thisArg, value, other, key, object, source);
    };
  }
  return function() {
    return func.apply(thisArg, arguments);
  };
}

module.exports = bindCallback;

},{"../utility/identity":30}],9:[function(require,module,exports){
var bindCallback = require('./bindCallback'),
    isIterateeCall = require('./isIterateeCall'),
    restParam = require('../function/restParam');

/**
 * Creates a `_.assign`, `_.defaults`, or `_.merge` function.
 *
 * @private
 * @param {Function} assigner The function to assign values.
 * @returns {Function} Returns the new assigner function.
 */
function createAssigner(assigner) {
  return restParam(function(object, sources) {
    var index = -1,
        length = object == null ? 0 : sources.length,
        customizer = length > 2 ? sources[length - 2] : undefined,
        guard = length > 2 ? sources[2] : undefined,
        thisArg = length > 1 ? sources[length - 1] : undefined;

    if (typeof customizer == 'function') {
      customizer = bindCallback(customizer, thisArg, 5);
      length -= 2;
    } else {
      customizer = typeof thisArg == 'function' ? thisArg : undefined;
      length -= (customizer ? 1 : 0);
    }
    if (guard && isIterateeCall(sources[0], sources[1], guard)) {
      customizer = length < 3 ? undefined : customizer;
      length = 1;
    }
    while (++index < length) {
      var source = sources[index];
      if (source) {
        assigner(object, source, customizer);
      }
    }
    return object;
  });
}

module.exports = createAssigner;

},{"../function/restParam":2,"./bindCallback":8,"./isIterateeCall":15}],10:[function(require,module,exports){
var restParam = require('../function/restParam');

/**
 * Creates a `_.defaults` or `_.defaultsDeep` function.
 *
 * @private
 * @param {Function} assigner The function to assign values.
 * @param {Function} customizer The function to customize assigned values.
 * @returns {Function} Returns the new defaults function.
 */
function createDefaults(assigner, customizer) {
  return restParam(function(args) {
    var object = args[0];
    if (object == null) {
      return object;
    }
    args.push(customizer);
    return assigner.apply(undefined, args);
  });
}

module.exports = createDefaults;

},{"../function/restParam":2}],11:[function(require,module,exports){
var baseProperty = require('./baseProperty');

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

module.exports = getLength;

},{"./baseProperty":7}],12:[function(require,module,exports){
var isNative = require('../lang/isNative');

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

module.exports = getNative;

},{"../lang/isNative":22}],13:[function(require,module,exports){
var getLength = require('./getLength'),
    isLength = require('./isLength');

/**
 * Checks if `value` is array-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 */
function isArrayLike(value) {
  return value != null && isLength(getLength(value));
}

module.exports = isArrayLike;

},{"./getLength":11,"./isLength":16}],14:[function(require,module,exports){
/** Used to detect unsigned integer values. */
var reIsUint = /^\d+$/;

/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

module.exports = isIndex;

},{}],15:[function(require,module,exports){
var isArrayLike = require('./isArrayLike'),
    isIndex = require('./isIndex'),
    isObject = require('../lang/isObject');

/**
 * Checks if the provided arguments are from an iteratee call.
 *
 * @private
 * @param {*} value The potential iteratee value argument.
 * @param {*} index The potential iteratee index or key argument.
 * @param {*} object The potential iteratee object argument.
 * @returns {boolean} Returns `true` if the arguments are from an iteratee call, else `false`.
 */
function isIterateeCall(value, index, object) {
  if (!isObject(object)) {
    return false;
  }
  var type = typeof index;
  if (type == 'number'
      ? (isArrayLike(object) && isIndex(index, object.length))
      : (type == 'string' && index in object)) {
    var other = object[index];
    return value === value ? (value === other) : (other !== other);
  }
  return false;
}

module.exports = isIterateeCall;

},{"../lang/isObject":24,"./isArrayLike":13,"./isIndex":14}],16:[function(require,module,exports){
/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

module.exports = isLength;

},{}],17:[function(require,module,exports){
/**
 * Checks if `value` is object-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

module.exports = isObjectLike;

},{}],18:[function(require,module,exports){
var isArguments = require('../lang/isArguments'),
    isArray = require('../lang/isArray'),
    isIndex = require('./isIndex'),
    isLength = require('./isLength'),
    keysIn = require('../object/keysIn');

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * A fallback implementation of `Object.keys` which creates an array of the
 * own enumerable property names of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function shimKeys(object) {
  var props = keysIn(object),
      propsLength = props.length,
      length = propsLength && object.length;

  var allowIndexes = !!length && isLength(length) &&
    (isArray(object) || isArguments(object));

  var index = -1,
      result = [];

  while (++index < propsLength) {
    var key = props[index];
    if ((allowIndexes && isIndex(key, length)) || hasOwnProperty.call(object, key)) {
      result.push(key);
    }
  }
  return result;
}

module.exports = shimKeys;

},{"../lang/isArguments":19,"../lang/isArray":20,"../object/keysIn":29,"./isIndex":14,"./isLength":16}],19:[function(require,module,exports){
var isArrayLike = require('../internal/isArrayLike'),
    isObjectLike = require('../internal/isObjectLike');

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Native method references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * Checks if `value` is classified as an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  return isObjectLike(value) && isArrayLike(value) &&
    hasOwnProperty.call(value, 'callee') && !propertyIsEnumerable.call(value, 'callee');
}

module.exports = isArguments;

},{"../internal/isArrayLike":13,"../internal/isObjectLike":17}],20:[function(require,module,exports){
var getNative = require('../internal/getNative'),
    isLength = require('../internal/isLength'),
    isObjectLike = require('../internal/isObjectLike');

/** `Object#toString` result references. */
var arrayTag = '[object Array]';

/** Used for native method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/* Native method references for those with the same name as other `lodash` methods. */
var nativeIsArray = getNative(Array, 'isArray');

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(function() { return arguments; }());
 * // => false
 */
var isArray = nativeIsArray || function(value) {
  return isObjectLike(value) && isLength(value.length) && objToString.call(value) == arrayTag;
};

module.exports = isArray;

},{"../internal/getNative":12,"../internal/isLength":16,"../internal/isObjectLike":17}],21:[function(require,module,exports){
var isObject = require('./isObject');

/** `Object#toString` result references. */
var funcTag = '[object Function]';

/** Used for native method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in older versions of Chrome and Safari which return 'function' for regexes
  // and Safari 8 which returns 'object' for typed array constructors.
  return isObject(value) && objToString.call(value) == funcTag;
}

module.exports = isFunction;

},{"./isObject":24}],22:[function(require,module,exports){
var isFunction = require('./isFunction'),
    isObjectLike = require('../internal/isObjectLike');

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var fnToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(fnToString.call(value));
  }
  return isObjectLike(value) && reIsHostCtor.test(value);
}

module.exports = isNative;

},{"../internal/isObjectLike":17,"./isFunction":21}],23:[function(require,module,exports){
var isObjectLike = require('../internal/isObjectLike');

/** `Object#toString` result references. */
var numberTag = '[object Number]';

/** Used for native method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/**
 * Checks if `value` is classified as a `Number` primitive or object.
 *
 * **Note:** To exclude `Infinity`, `-Infinity`, and `NaN`, which are classified
 * as numbers, use the `_.isFinite` method.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isNumber(8.4);
 * // => true
 *
 * _.isNumber(NaN);
 * // => true
 *
 * _.isNumber('8.4');
 * // => false
 */
function isNumber(value) {
  return typeof value == 'number' || (isObjectLike(value) && objToString.call(value) == numberTag);
}

module.exports = isNumber;

},{"../internal/isObjectLike":17}],24:[function(require,module,exports){
/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

module.exports = isObject;

},{}],25:[function(require,module,exports){
var isObjectLike = require('../internal/isObjectLike');

/** `Object#toString` result references. */
var stringTag = '[object String]';

/** Used for native method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/**
 * Checks if `value` is classified as a `String` primitive or object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isString('abc');
 * // => true
 *
 * _.isString(1);
 * // => false
 */
function isString(value) {
  return typeof value == 'string' || (isObjectLike(value) && objToString.call(value) == stringTag);
}

module.exports = isString;

},{"../internal/isObjectLike":17}],26:[function(require,module,exports){
var assignWith = require('../internal/assignWith'),
    baseAssign = require('../internal/baseAssign'),
    createAssigner = require('../internal/createAssigner');

/**
 * Assigns own enumerable properties of source object(s) to the destination
 * object. Subsequent sources overwrite property assignments of previous sources.
 * If `customizer` is provided it's invoked to produce the assigned values.
 * The `customizer` is bound to `thisArg` and invoked with five arguments:
 * (objectValue, sourceValue, key, object, source).
 *
 * **Note:** This method mutates `object` and is based on
 * [`Object.assign`](http://ecma-international.org/ecma-262/6.0/#sec-object.assign).
 *
 * @static
 * @memberOf _
 * @alias extend
 * @category Object
 * @param {Object} object The destination object.
 * @param {...Object} [sources] The source objects.
 * @param {Function} [customizer] The function to customize assigned values.
 * @param {*} [thisArg] The `this` binding of `customizer`.
 * @returns {Object} Returns `object`.
 * @example
 *
 * _.assign({ 'user': 'barney' }, { 'age': 40 }, { 'user': 'fred' });
 * // => { 'user': 'fred', 'age': 40 }
 *
 * // using a customizer callback
 * var defaults = _.partialRight(_.assign, function(value, other) {
 *   return _.isUndefined(value) ? other : value;
 * });
 *
 * defaults({ 'user': 'barney' }, { 'age': 36 }, { 'user': 'fred' });
 * // => { 'user': 'barney', 'age': 36 }
 */
var assign = createAssigner(function(object, source, customizer) {
  return customizer
    ? assignWith(object, source, customizer)
    : baseAssign(object, source);
});

module.exports = assign;

},{"../internal/assignWith":4,"../internal/baseAssign":5,"../internal/createAssigner":9}],27:[function(require,module,exports){
var assign = require('./assign'),
    assignDefaults = require('../internal/assignDefaults'),
    createDefaults = require('../internal/createDefaults');

/**
 * Assigns own enumerable properties of source object(s) to the destination
 * object for all destination properties that resolve to `undefined`. Once a
 * property is set, additional values of the same property are ignored.
 *
 * **Note:** This method mutates `object`.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The destination object.
 * @param {...Object} [sources] The source objects.
 * @returns {Object} Returns `object`.
 * @example
 *
 * _.defaults({ 'user': 'barney' }, { 'age': 36 }, { 'user': 'fred' });
 * // => { 'user': 'barney', 'age': 36 }
 */
var defaults = createDefaults(assign, assignDefaults);

module.exports = defaults;

},{"../internal/assignDefaults":3,"../internal/createDefaults":10,"./assign":26}],28:[function(require,module,exports){
var getNative = require('../internal/getNative'),
    isArrayLike = require('../internal/isArrayLike'),
    isObject = require('../lang/isObject'),
    shimKeys = require('../internal/shimKeys');

/* Native method references for those with the same name as other `lodash` methods. */
var nativeKeys = getNative(Object, 'keys');

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/6.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
var keys = !nativeKeys ? shimKeys : function(object) {
  var Ctor = object == null ? undefined : object.constructor;
  if ((typeof Ctor == 'function' && Ctor.prototype === object) ||
      (typeof object != 'function' && isArrayLike(object))) {
    return shimKeys(object);
  }
  return isObject(object) ? nativeKeys(object) : [];
};

module.exports = keys;

},{"../internal/getNative":12,"../internal/isArrayLike":13,"../internal/shimKeys":18,"../lang/isObject":24}],29:[function(require,module,exports){
var isArguments = require('../lang/isArguments'),
    isArray = require('../lang/isArray'),
    isIndex = require('../internal/isIndex'),
    isLength = require('../internal/isLength'),
    isObject = require('../lang/isObject');

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Creates an array of the own and inherited enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keysIn(new Foo);
 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
 */
function keysIn(object) {
  if (object == null) {
    return [];
  }
  if (!isObject(object)) {
    object = Object(object);
  }
  var length = object.length;
  length = (length && isLength(length) &&
    (isArray(object) || isArguments(object)) && length) || 0;

  var Ctor = object.constructor,
      index = -1,
      isProto = typeof Ctor == 'function' && Ctor.prototype === object,
      result = Array(length),
      skipIndexes = length > 0;

  while (++index < length) {
    result[index] = (index + '');
  }
  for (var key in object) {
    if (!(skipIndexes && isIndex(key, length)) &&
        !(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}

module.exports = keysIn;

},{"../internal/isIndex":14,"../internal/isLength":16,"../lang/isArguments":19,"../lang/isArray":20,"../lang/isObject":24}],30:[function(require,module,exports){
/**
 * This method returns the first argument provided to it.
 *
 * @static
 * @memberOf _
 * @category Utility
 * @param {*} value Any value.
 * @returns {*} Returns `value`.
 * @example
 *
 * var object = { 'user': 'fred' };
 *
 * _.identity(object) === object;
 * // => true
 */
function identity(value) {
  return value;
}

module.exports = identity;

},{}],31:[function(require,module,exports){
var bundleFn = arguments[3];
var sources = arguments[4];
var cache = arguments[5];

var stringify = JSON.stringify;

module.exports = function (fn) {
    var keys = [];
    var wkey;
    var cacheKeys = Object.keys(cache);
    
    for (var i = 0, l = cacheKeys.length; i < l; i++) {
        var key = cacheKeys[i];
        if (cache[key].exports === fn) {
            wkey = key;
            break;
        }
    }
    
    if (!wkey) {
        wkey = Math.floor(Math.pow(16, 8) * Math.random()).toString(16);
        var wcache = {};
        for (var i = 0, l = cacheKeys.length; i < l; i++) {
            var key = cacheKeys[i];
            wcache[key] = key;
        }
        sources[wkey] = [
            Function(['require','module','exports'], '(' + fn + ')(self)'),
            wcache
        ];
    }
    var skey = Math.floor(Math.pow(16, 8) * Math.random()).toString(16);
    
    var scache = {}; scache[wkey] = wkey;
    sources[skey] = [
        Function(['require'],'require(' + stringify(wkey) + ')(self)'),
        scache
    ];
    
    var src = '(' + bundleFn + ')({'
        + Object.keys(sources).map(function (key) {
            return stringify(key) + ':['
                + sources[key][0]
                + ',' + stringify(sources[key][1]) + ']'
            ;
        }).join(',')
        + '},{},[' + stringify(skey) + '])'
    ;
    
    var URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
    
    return new Worker(URL.createObjectURL(
        new Blob([src], { type: 'text/javascript' })
    ));
};

},{}],32:[function(require,module,exports){
console.log("Canvas player!");

(function(ns) {
  ns.CanvasPlayer = require('./player');
  ns.CanvasClip = require('./clip');
  ns.ColorUtil = require('./color');
})(window);


},{"./clip":33,"./color":34,"./player":36}],33:[function(require,module,exports){
var CanvasClip, ColorUtil, Playable, Runner, defaults, isFunction, isNumber,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  slice = [].slice;

defaults = require('lodash/object/defaults');

Playable = require('./playable');

isNumber = require('lodash/lang/isNumber');

isFunction = require('lodash/lang/isFunction');

Runner = require('./runner');

ColorUtil = require('./color');

module.exports = CanvasClip = (function(superClass) {
  extend(CanvasClip, superClass);

  CanvasClip.DefaultOpts = {
    fps: 15,
    width: 800,
    height: 450,
    maxConcurrency: 10
  };

  function CanvasClip(sprite, opts) {
    this.sprite = sprite;
    this.apply = bind(this.apply, this);
    this._onError = bind(this._onError, this);
    this._onLoad = bind(this._onLoad, this);
    this.opts = defaults({}, opts, this.constructor.DefaultOpts);
    console.log(this.opts);
    console.log(this.sprite);
    this._loaded = false;
    this._in_t = this._out_t = 0;
    this._duration = 1000 / this.opts.fps * this.opts.frames;
    this._alpha_transfroms = [];
    this._filters = [];
    this._status = "idle";
    this._load();
  }

  CanvasClip.prototype._load = function() {
    this._ori_image = new Image();
    this._ori_image.onload = this._onLoad;
    this._ori_image.onerror = this._onError;
    return this._ori_image.src = this.sprite;
  };

  CanvasClip.prototype._onLoad = function() {
    this._loaded = true;
    this._status = "loaded";
    return this.emit('loaded');
  };

  CanvasClip.prototype._onError = function(e) {
    this._status = 'error';
    return this.emit('error', e);
  };

  CanvasClip.prototype.getStatus = function() {
    return this._status;
  };

  CanvasClip.prototype.duration = function() {
    return this._in_t + this._duration + this._out_t;
  };

  CanvasClip.prototype.apply = function() {
    if (this._loaded) {
      console.time("apply");
      this._applyFadeIn();
      this._applyFadeOut();
      console.time("filter");
      return this._applyFiltersInWorker((function(_this) {
        return function(err) {
          console.timeEnd("filter");
          console.timeEnd("apply");
          if (err) {
            return _this.emit('error', err);
          }
          _this._status = 'ready';
          return _this.emit('ready');
        };
      })(this));
    } else {
      return this.once('loaded', this.apply);
    }
  };

  CanvasClip.prototype.willPlay = function() {
    return this.apply();
  };

  CanvasClip.prototype._applyFadeIn = function() {
    var in_target_alpha;
    if (this._in_t > 0) {
      in_target_alpha = this._applyAlphaTransform("clip", 0);
      return this.alpha(function(state, p) {
        if (state === 'fade_in') {
          return p * in_target_alpha;
        }
        return -1;
      });
    }
  };

  CanvasClip.prototype._applyFadeOut = function() {
    var out_from_alpha;
    if (this._out_t > 0) {
      out_from_alpha = this._applyAlphaTransform("clip", 1);
      return this.alpha(function(state, p) {
        if (state === 'fade_out') {
          return (1 - p) * out_from_alpha;
        }
        return -1;
      });
    }
  };

  CanvasClip.prototype._applyFilters = function(cb) {
    var height, imageData, ref, width;
    ref = this._ori_image, width = ref.width, height = ref.height;
    if (this.filterCanvas == null) {
      console.time("init");
      this.filterCanvas = document.createElement('canvas');
      this.filterCanvas.width = width;
      this.filterCanvas.height = height;
      this.filterCtx = this.filterCanvas.getContext('2d');
      this._image = new Image();
      console.timeEnd("init");
    }
    console.time("read");
    this.filterCtx.drawImage(this._ori_image, 0, 0);
    this._imageData = imageData = this.filterCtx.getImageData(0, 0, width, height);
    console.timeEnd("read");
    console.time("run");
    this._filters.forEach(function(filter) {
      return filter.f.apply(filter, [imageData, ColorUtil].concat(slice.call(filter.args)));
    });
    this.filterCtx.putImageData(imageData, 0, 0);
    console.timeEnd("run");
    return cb();
  };

  CanvasClip.prototype._applyFiltersInWorker = function(callback) {
    var done, doneCount, errors, height, i, imageData, j, k, merge, n, processed, ref, ref1, ref2, results, runners, s, segs, step, width;
    ref = this._ori_image, width = ref.width, height = ref.height;
    if (this.filterCanvas == null) {
      this.filterCanvas = document.createElement('canvas');
      this.filterCanvas.width = width;
      this.filterCanvas.height = height;
      this.filterCtx = this.filterCanvas.getContext('2d');
      this._image = new Image();
    }
    this.filterCtx.drawImage(this._ori_image, 0, 0);
    imageData = this.filterCtx.getImageData(0, 0, width, height);
    done = (function(_this) {
      return function(err, data) {
        if (err) {
          console.error(err);
          return callback(err);
        }
        if (data) {
          _this.filterCtx.putImageData(data, 0, 0);
        }
        return callback();
      };
    })(this);
    if (this._filters.length > 0) {
      n = this.opts.maxConcurrency;
      segs = [];
      if (!this._runners) {
        this._runners = (function() {
          results = [];
          for (var j = 0, ref1 = n - 1; 0 <= ref1 ? j <= ref1 : j >= ref1; 0 <= ref1 ? j++ : j--){ results.push(j); }
          return results;
        }).apply(this).map(function() {
          return new Runner();
        });
      }
      runners = this._runners;
      step = height / n;
      console.time("Split");
      for (i = k = 0, ref2 = n - 1; 0 <= ref2 ? k <= ref2 : k >= ref2; i = 0 <= ref2 ? ++k : --k) {
        s = this.filterCtx.getImageData(0, step * i, width, step);
        segs.push(s);
      }
      console.timeEnd("Split");
      doneCount = 0;
      processed = [];
      errors = [];
      merge = (function(_this) {
        return function() {
          var l, ref3;
          if (errors.length > 0) {
            return done(errors);
          }
          console.time("merge");
          for (i = l = 0, ref3 = n - 1; 0 <= ref3 ? l <= ref3 : l >= ref3; i = 0 <= ref3 ? ++l : --l) {
            s = _this.filterCtx.putImageData(processed[i], 0, step * i);
          }
          console.timeEnd("merge");
          return done();
        };
      })(this);
      console.time("run");
      return runners.forEach((function(_this) {
        return function(runner, i) {
          return runner.run((function(filters, args, data, ColorUtil) {
            filters.forEach(function(f, i) {
              return f.apply(void 0, [data, ColorUtil].concat(args[i]));
            });
            return data;
          }), _this._filters.map(function(f) {
            return f.f;
          }), _this._filters.map(function(f) {
            return f.args;
          }), segs[i], function(err, part) {
            doneCount++;
            if (err) {
              console.error(i + ":");
              console.error(err);
              errors.push(err);
            } else {
              processed[i] = part;
            }
            if (doneCount === n) {
              console.timeEnd('run');
              return merge();
            }
          });
        };
      })(this));
    } else {
      return done();
    }
  };

  CanvasClip.prototype.render = function(ctx, dt) {
    var cols, dt_abs, f, fade_in_p, fade_out_p, fps, frames, height, p, ref, state, width, x, y;
    ref = this.opts, width = ref.width, height = ref.height, cols = ref.cols, fps = ref.fps, frames = ref.frames;
    dt_abs = dt - this._in_t;
    state = "clip";
    if (dt_abs < 0) {
      state = "fade_in";
      dt_abs = 0;
      p = fade_in_p = dt / this._in_t;
      f = 0;
    } else if (dt_abs > this._duration) {
      state = "fade_out";
      p = fade_out_p = (dt_abs - this._duration) / this._out_t;
      dt_abs = this._duration;
      f = frames - 1;
    } else {
      state = "clip";
      f = dt_abs / (1000 / fps);
      p = (dt - this._in_t) / this._duration;
    }
    x = ~~(f % cols) * width;
    y = ~~(f / cols) * height;
    ctx.globalAlpha = this._applyAlphaTransform(state, p);
    return ctx.drawImage(this.filterCanvas, x, y, width, height, this._applyTransform("x", state, p), this._applyTransform("y", state, p), width, height);
  };

  CanvasClip.prototype.renderFrame = function(ctx, f) {
    var cols, fps, frames, height, p, ref, width, x, y;
    ref = this.opts, width = ref.width, height = ref.height, cols = ref.cols, fps = ref.fps, frames = ref.frames;
    x = ~~(f % cols) * width;
    y = ~~(f / cols) * height;
    p = f / frames;
    ctx.globalAlpha = this._applyAlphaTransform('clip', p);
    return ctx.drawImage(this.filterCanvas, x, y, width, height, this._applyTransform("x", 'clip', p), this._applyTransform("y", 'clip', p), width, height);
  };

  CanvasClip.prototype._applyAlphaTransform = function(state, p) {
    var applyAlpha, final;
    if (this._alpha_transfroms.length === 0) {
      return 1;
    }
    applyAlpha = function(f) {
      if (isNumber(f)) {
        return f;
      }
      if (isFunction(f)) {
        return f(state, p);
      }
    };
    final = 1;
    this._alpha_transfroms.forEach(function(f) {
      var a;
      a = applyAlpha(f);
      if (a >= 0) {
        return final = a;
      }
    });
    return final;
  };

  CanvasClip.prototype._applyTransform = function(t, state, p) {
    var trans;
    trans = this["t" + t];
    if (trans == null) {
      return 0;
    }
    if (isNumber(trans)) {
      return trans;
    }
    return trans(state, p);
  };

  CanvasClip.prototype.fadeIn = function(t) {
    this._in_t = t;
    return this;
  };

  CanvasClip.prototype.fadeOut = function(t) {
    this._out_t = t;
    return this;
  };

  CanvasClip.prototype.addFilter = function() {
    var args, f;
    f = arguments[0], args = 2 <= arguments.length ? slice.call(arguments, 1) : [];
    if (isFunction(f)) {
      this._status = this._status === 'ready' ? 'loaded' : 'idle';
      this._filters.push({
        f: f,
        args: args != null ? args : []
      });
    }
    return this;
  };

  CanvasClip.prototype.removeFilter = function(f) {
    var i;
    if (isFunction(f)) {
      i = this._filters.findIndex(function(filter) {
        return filter.f === f;
      });
      if (i >= 0) {
        this._status = this._status === 'ready' ? 'loaded' : 'idle';
        this._filters.splice(i, 1);
      }
    }
    return this;
  };

  CanvasClip.prototype.updateFilter = function() {
    var args, f, filter;
    f = arguments[0], args = 2 <= arguments.length ? slice.call(arguments, 1) : [];
    if (isFunction(f)) {
      filter = this._filters.find(function(filter) {
        return filter.f === f;
      });
      this._status = this._status === 'ready' ? 'loaded' : 'idle';
      if (filter != null) {
        filter.args = args;
      }
    }
    return this;
  };

  CanvasClip.prototype.clearFilters = function() {
    this._filters = [];
    this._status = this._status === 'ready' ? 'loaded' : 'idle';
    return this;
  };

  CanvasClip.prototype.x = function(tx) {
    if (isNumber(tx) || isFunction(tx)) {
      this.tx = tx;
    }
    return this;
  };

  CanvasClip.prototype.y = function(ty) {
    if (isNumber(ty) || isFunction(ty)) {
      this.ty = ty;
    }
    return this;
  };

  CanvasClip.prototype.scale = function(ts) {
    this.ts = ts;
    return this;
  };

  CanvasClip.prototype.alpha = function(ta) {
    if (isNumber(ta) || isFunction(ta)) {
      this._alpha_transfroms.push(ta);
    }
    return this;
  };

  return CanvasClip;

})(Playable);


},{"./color":34,"./playable":35,"./runner":37,"lodash/lang/isFunction":21,"lodash/lang/isNumber":23,"lodash/object/defaults":27}],34:[function(require,module,exports){
module.exports = {
  rgbToHsl: function(r, g, b) {
    var d, h, l, max, min, s;
    r /= 255;
    g /= 255;
    b /= 255;
    max = Math.max(r, g, b);
    min = Math.min(r, g, b);
    h = void 0;
    s = void 0;
    l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
      }
      h /= 6;
    }
    return [h, s, l];
  },
  hslToRgb: function(h, s, l) {
    var b, g, hue2rgb, p, q, r;
    r = void 0;
    g = void 0;
    b = void 0;
    hue2rgb = function(p, q, t) {
      if (t < 0) {
        t += 1;
      }
      if (t > 1) {
        t -= 1;
      }
      if (t < 1 / 6) {
        return p + (q - p) * 6 * t;
      }
      if (t < 1 / 2) {
        return q;
      }
      if (t < 2 / 3) {
        return p + (q - p) * (2 / 3 - t) * 6;
      }
      return p;
    };
    if (s === 0) {
      r = g = b = l;
    } else {
      q = l < 0.5 ? l * (1 + s) : l + s - (l * s);
      p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - (1 / 3));
    }
    return [r * 255, g * 255, b * 255];
  }
};


},{}],35:[function(require,module,exports){
var EventEmitter, Playable,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

EventEmitter = require('events').EventEmitter;

module.exports = Playable = (function(superClass) {
  extend(Playable, superClass);

  function Playable() {
    return Playable.__super__.constructor.apply(this, arguments);
  }

  Playable.prototype.willPlay = function() {};

  Playable.prototype.render = function(ctx, dt) {
    throw new Error("Not implemented");
  };

  Playable.prototype.duration = function() {
    throw new Error("Not implemented");
  };

  Playable.prototype.getStatus = function() {
    throw new Error("Not implemented");
  };

  return Playable;

})(EventEmitter);


},{"events":1}],36:[function(require,module,exports){
var CanvasPlayer, EventEmitter, defaults, isString,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

EventEmitter = require('events').EventEmitter;

defaults = require('lodash/object/defaults');

isString = require('lodash/lang/isString');

module.exports = CanvasPlayer = (function(superClass) {
  extend(CanvasPlayer, superClass);

  CanvasPlayer.DefaultOpts = {
    width: 800,
    height: 450
  };

  function CanvasPlayer(el, opts) {
    this._tick = bind(this._tick, this);
    this.play = bind(this.play, this);
    this.opts = defaults({}, opts, this.constructor.DefaultOpts);
    this.el = isString(el) ? document.querySelector(el) : el;
    this._stopping = false;
    this._initCanvas();
  }

  CanvasPlayer.prototype._initCanvas = function() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.opts.width;
    this.canvas.height = this.opts.height;
    this.ctx = this.canvas.getContext('2d');
    return this.el.appendChild(this.canvas);
  };

  CanvasPlayer.prototype.play = function(playable) {
    if (playable.getStatus() !== 'ready') {
      console.log("waiting: " + (playable.getStatus()));
      playable.once('ready', this.play.bind(this, playable));
    } else {
      this._t0 = -1;
      this.playable = playable;
      console.log("Play");
      this.emit("play");
      requestAnimationFrame(this._tick);
    }
    return this;
  };

  CanvasPlayer.prototype.stop = function() {
    return this._stopping = true;
  };

  CanvasPlayer.prototype.seek = function(playable, f) {
    return playable.renderFrame(this.ctx, f);
  };

  CanvasPlayer.prototype.pause = function() {
    return this.emit("pause");
  };

  CanvasPlayer.prototype.resume = function() {
    return this.emit("resume");
  };

  CanvasPlayer.prototype._tick = function(t) {
    var dt;
    if (this._t0 < 0) {
      this._t0 = t;
    }
    dt = (t - this._t0) % this.playable.duration();
    console.log(dt);
    this.ctx.clearRect(0, 0, this.opts.width, this.opts.height);
    this.playable.render(this.ctx, dt);
    requestAnimationFrame(this._tick);
    if (this._t0 !== t && dt < 1000 / 60) {
      return this.emit("complete");
    }
  };

  return CanvasPlayer;

})(EventEmitter);


},{"events":1,"lodash/lang/isString":25,"lodash/object/defaults":27}],37:[function(require,module,exports){
var Runner, TASK_COUNT, Work, fnRegex, isArray, isFunction,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  slice = [].slice;

isFunction = require('lodash/lang/isFunction');

isArray = require('lodash/lang/isArray');

Work = require('webworkify');

fnRegex = /function\s*.*\s*\((.*)\)\s*\{([\s\S]*)\}/;

TASK_COUNT = 0;

module.exports = Runner = (function() {
  function Runner() {
    this.onMessage = bind(this.onMessage, this);
    this.worker = new Work(require('./worker'));
    this.worker.addEventListener('message', this.onMessage);
    this._callbacks = {};
  }

  Runner.prototype.onMessage = function(e) {
    var cb, id, ret;
    ret = e.data;
    id = ret.id;
    cb = this._callbacks[id];
    delete this._callbacks[id];
    return typeof cb === "function" ? cb(ret.err, ret.result) : void 0;
  };

  Runner.prototype.packFn = function(fn) {
    var args, body, f, m;
    if (!isFunction(fn)) {
      throw new TypeError("'fn' is not a function");
    }
    m = fn.toString().match(fnRegex);
    args = m[1].split(",").map(function(s) {
      return s.trim();
    });
    body = m[2];
    f = {
      args: args,
      body: body
    };
    return f;
  };

  Runner.prototype.packFnInArray = function(arr) {
    var a, i, j, len;
    for (i = j = 0, len = arr.length; j < len; i = ++j) {
      a = arr[i];
      if (isFunction(a)) {
        arr[i] = this.packFn(a);
      } else if (isArray(a)) {
        arr[i] = this.packFnInArray(a);
      }
    }
    return arr;
  };

  Runner.prototype.run = function() {
    var args, cb, fn, j, payload;
    fn = arguments[0], args = 3 <= arguments.length ? slice.call(arguments, 1, j = arguments.length - 1) : (j = 1, []), cb = arguments[j++];
    payload = {
      id: TASK_COUNT++,
      fn: this.packFn(fn),
      args: this.packFnInArray(args)
    };
    this.worker.postMessage(payload);
    return this._callbacks[payload.id] = cb;
  };

  return Runner;

})();


},{"./worker":38,"lodash/lang/isArray":20,"lodash/lang/isFunction":21,"webworkify":31}],38:[function(require,module,exports){
var ColorUtil, buildFn, buildFnInArray, isArray, isObject, isPackedFunction, isString;

isObject = require('lodash/lang/isObject');

isArray = require('lodash/lang/isArray');

isString = require('lodash/lang/isString');

ColorUtil = require('./color');

isPackedFunction = function(f) {
  return isObject(f) && isArray(f.args) && isString(f.body);
};

buildFn = function(arg) {
  var args, body;
  args = arg.args, body = arg.body;
  args = args.concat(body);
  args.unshift(null);
  return new (Function.prototype.bind.apply(Function, args));
};

buildFnInArray = function(arr) {
  var a, i, j, len;
  for (i = j = 0, len = arr.length; j < len; i = ++j) {
    a = arr[i];
    if (isPackedFunction(a)) {
      arr[i] = buildFn(a);
    } else if (isArray(a)) {
      arr[i] = buildFnInArray(a);
    }
  }
  return arr;
};

module.exports = function(self) {
  return self.addEventListener('message', function(e) {
    var args, err, error, error1, fn, payload, r, ret;
    payload = e.data;
    fn = buildFn(payload.fn);
    args = buildFnInArray(payload.args);
    args.push(ColorUtil);
    try {
      r = fn.apply(null, args);
    } catch (error1) {
      error = error1;
      err = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    ret = {
      id: payload.id,
      result: r,
      err: err
    };
    return self.postMessage(ret);
  });
};


},{"./color":34,"lodash/lang/isArray":20,"lodash/lang/isObject":24,"lodash/lang/isString":25}]},{},[32])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvZnVuY3Rpb24vcmVzdFBhcmFtLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9pbnRlcm5hbC9hc3NpZ25EZWZhdWx0cy5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvaW50ZXJuYWwvYXNzaWduV2l0aC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvaW50ZXJuYWwvYmFzZUFzc2lnbi5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvaW50ZXJuYWwvYmFzZUNvcHkuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL2ludGVybmFsL2Jhc2VQcm9wZXJ0eS5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvaW50ZXJuYWwvYmluZENhbGxiYWNrLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9pbnRlcm5hbC9jcmVhdGVBc3NpZ25lci5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvaW50ZXJuYWwvY3JlYXRlRGVmYXVsdHMuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL2ludGVybmFsL2dldExlbmd0aC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvaW50ZXJuYWwvZ2V0TmF0aXZlLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9pbnRlcm5hbC9pc0FycmF5TGlrZS5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvaW50ZXJuYWwvaXNJbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvaW50ZXJuYWwvaXNJdGVyYXRlZUNhbGwuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL2ludGVybmFsL2lzTGVuZ3RoLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9pbnRlcm5hbC9pc09iamVjdExpa2UuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL2ludGVybmFsL3NoaW1LZXlzLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9sYW5nL2lzQXJndW1lbnRzLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9sYW5nL2lzQXJyYXkuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL2xhbmcvaXNGdW5jdGlvbi5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvbGFuZy9pc05hdGl2ZS5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvbGFuZy9pc051bWJlci5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvbGFuZy9pc09iamVjdC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvbGFuZy9pc1N0cmluZy5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvb2JqZWN0L2Fzc2lnbi5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvb2JqZWN0L2RlZmF1bHRzLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9vYmplY3Qva2V5cy5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvb2JqZWN0L2tleXNJbi5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvdXRpbGl0eS9pZGVudGl0eS5qcyIsIm5vZGVfbW9kdWxlcy93ZWJ3b3JraWZ5L2luZGV4LmpzIiwiRjpcXGRldlxcanNcXENhbnZhc1BsYXllclxcc3JjXFxidW5kbGUuY29mZmVlIiwiRjpcXGRldlxcanNcXENhbnZhc1BsYXllclxcc3JjXFxjbGlwLmNvZmZlZSIsIkY6XFxkZXZcXGpzXFxDYW52YXNQbGF5ZXJcXHNyY1xcY29sb3IuY29mZmVlIiwiRjpcXGRldlxcanNcXENhbnZhc1BsYXllclxcc3JjXFxwbGF5YWJsZS5jb2ZmZWUiLCJGOlxcZGV2XFxqc1xcQ2FudmFzUGxheWVyXFxzcmNcXHBsYXllci5jb2ZmZWUiLCJGOlxcZGV2XFxqc1xcQ2FudmFzUGxheWVyXFxzcmNcXHJ1bm5lci5jb2ZmZWUiLCJGOlxcZGV2XFxqc1xcQ2FudmFzUGxheWVyXFxzcmNcXHdvcmtlci5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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TyxDQUFDLEVBQVo7TUFDQSxNQUFBLEVBQVEsQ0FEUjtNQUVBLEdBQUEsRUFBSyxHQUZMOztXQUdGLElBQUksQ0FBQyxXQUFMLENBQWlCLEdBQWpCO0VBakIrQixDQUFqQztBQURlIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSBpZiAobGlzdGVuZXJzKSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24odHlwZSkge1xuICBpZiAodGhpcy5fZXZlbnRzKSB7XG4gICAgdmFyIGV2bGlzdGVuZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgICBpZiAoaXNGdW5jdGlvbihldmxpc3RlbmVyKSlcbiAgICAgIHJldHVybiAxO1xuICAgIGVsc2UgaWYgKGV2bGlzdGVuZXIpXG4gICAgICByZXR1cm4gZXZsaXN0ZW5lci5sZW5ndGg7XG4gIH1cbiAgcmV0dXJuIDA7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgcmV0dXJuIGVtaXR0ZXIubGlzdGVuZXJDb3VudCh0eXBlKTtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsIi8qKiBVc2VkIGFzIHRoZSBgVHlwZUVycm9yYCBtZXNzYWdlIGZvciBcIkZ1bmN0aW9uc1wiIG1ldGhvZHMuICovXG52YXIgRlVOQ19FUlJPUl9URVhUID0gJ0V4cGVjdGVkIGEgZnVuY3Rpb24nO1xuXG4vKiBOYXRpdmUgbWV0aG9kIHJlZmVyZW5jZXMgZm9yIHRob3NlIHdpdGggdGhlIHNhbWUgbmFtZSBhcyBvdGhlciBgbG9kYXNoYCBtZXRob2RzLiAqL1xudmFyIG5hdGl2ZU1heCA9IE1hdGgubWF4O1xuXG4vKipcbiAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IGludm9rZXMgYGZ1bmNgIHdpdGggdGhlIGB0aGlzYCBiaW5kaW5nIG9mIHRoZVxuICogY3JlYXRlZCBmdW5jdGlvbiBhbmQgYXJndW1lbnRzIGZyb20gYHN0YXJ0YCBhbmQgYmV5b25kIHByb3ZpZGVkIGFzIGFuIGFycmF5LlxuICpcbiAqICoqTm90ZToqKiBUaGlzIG1ldGhvZCBpcyBiYXNlZCBvbiB0aGUgW3Jlc3QgcGFyYW1ldGVyXShodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvRnVuY3Rpb25zL3Jlc3RfcGFyYW1ldGVycykuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBGdW5jdGlvblxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gYXBwbHkgYSByZXN0IHBhcmFtZXRlciB0by5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbc3RhcnQ9ZnVuYy5sZW5ndGgtMV0gVGhlIHN0YXJ0IHBvc2l0aW9uIG9mIHRoZSByZXN0IHBhcmFtZXRlci5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGZ1bmN0aW9uLlxuICogQGV4YW1wbGVcbiAqXG4gKiB2YXIgc2F5ID0gXy5yZXN0UGFyYW0oZnVuY3Rpb24od2hhdCwgbmFtZXMpIHtcbiAqICAgcmV0dXJuIHdoYXQgKyAnICcgKyBfLmluaXRpYWwobmFtZXMpLmpvaW4oJywgJykgK1xuICogICAgIChfLnNpemUobmFtZXMpID4gMSA/ICcsICYgJyA6ICcnKSArIF8ubGFzdChuYW1lcyk7XG4gKiB9KTtcbiAqXG4gKiBzYXkoJ2hlbGxvJywgJ2ZyZWQnLCAnYmFybmV5JywgJ3BlYmJsZXMnKTtcbiAqIC8vID0+ICdoZWxsbyBmcmVkLCBiYXJuZXksICYgcGViYmxlcydcbiAqL1xuZnVuY3Rpb24gcmVzdFBhcmFtKGZ1bmMsIHN0YXJ0KSB7XG4gIGlmICh0eXBlb2YgZnVuYyAhPSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihGVU5DX0VSUk9SX1RFWFQpO1xuICB9XG4gIHN0YXJ0ID0gbmF0aXZlTWF4KHN0YXJ0ID09PSB1bmRlZmluZWQgPyAoZnVuYy5sZW5ndGggLSAxKSA6ICgrc3RhcnQgfHwgMCksIDApO1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGFyZ3MgPSBhcmd1bWVudHMsXG4gICAgICAgIGluZGV4ID0gLTEsXG4gICAgICAgIGxlbmd0aCA9IG5hdGl2ZU1heChhcmdzLmxlbmd0aCAtIHN0YXJ0LCAwKSxcbiAgICAgICAgcmVzdCA9IEFycmF5KGxlbmd0aCk7XG5cbiAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgcmVzdFtpbmRleF0gPSBhcmdzW3N0YXJ0ICsgaW5kZXhdO1xuICAgIH1cbiAgICBzd2l0Y2ggKHN0YXJ0KSB7XG4gICAgICBjYXNlIDA6IHJldHVybiBmdW5jLmNhbGwodGhpcywgcmVzdCk7XG4gICAgICBjYXNlIDE6IHJldHVybiBmdW5jLmNhbGwodGhpcywgYXJnc1swXSwgcmVzdCk7XG4gICAgICBjYXNlIDI6IHJldHVybiBmdW5jLmNhbGwodGhpcywgYXJnc1swXSwgYXJnc1sxXSwgcmVzdCk7XG4gICAgfVxuICAgIHZhciBvdGhlckFyZ3MgPSBBcnJheShzdGFydCArIDEpO1xuICAgIGluZGV4ID0gLTE7XG4gICAgd2hpbGUgKCsraW5kZXggPCBzdGFydCkge1xuICAgICAgb3RoZXJBcmdzW2luZGV4XSA9IGFyZ3NbaW5kZXhdO1xuICAgIH1cbiAgICBvdGhlckFyZ3Nbc3RhcnRdID0gcmVzdDtcbiAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzLCBvdGhlckFyZ3MpO1xuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHJlc3RQYXJhbTtcbiIsIi8qKlxuICogVXNlZCBieSBgXy5kZWZhdWx0c2AgdG8gY3VzdG9taXplIGl0cyBgXy5hc3NpZ25gIHVzZS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSBvYmplY3RWYWx1ZSBUaGUgZGVzdGluYXRpb24gb2JqZWN0IHByb3BlcnR5IHZhbHVlLlxuICogQHBhcmFtIHsqfSBzb3VyY2VWYWx1ZSBUaGUgc291cmNlIG9iamVjdCBwcm9wZXJ0eSB2YWx1ZS5cbiAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSB2YWx1ZSB0byBhc3NpZ24gdG8gdGhlIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAqL1xuZnVuY3Rpb24gYXNzaWduRGVmYXVsdHMob2JqZWN0VmFsdWUsIHNvdXJjZVZhbHVlKSB7XG4gIHJldHVybiBvYmplY3RWYWx1ZSA9PT0gdW5kZWZpbmVkID8gc291cmNlVmFsdWUgOiBvYmplY3RWYWx1ZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhc3NpZ25EZWZhdWx0cztcbiIsInZhciBrZXlzID0gcmVxdWlyZSgnLi4vb2JqZWN0L2tleXMnKTtcblxuLyoqXG4gKiBBIHNwZWNpYWxpemVkIHZlcnNpb24gb2YgYF8uYXNzaWduYCBmb3IgY3VzdG9taXppbmcgYXNzaWduZWQgdmFsdWVzIHdpdGhvdXRcbiAqIHN1cHBvcnQgZm9yIGFyZ3VtZW50IGp1Z2dsaW5nLCBtdWx0aXBsZSBzb3VyY2VzLCBhbmQgYHRoaXNgIGJpbmRpbmcgYGN1c3RvbWl6ZXJgXG4gKiBmdW5jdGlvbnMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBzb3VyY2UgVGhlIHNvdXJjZSBvYmplY3QuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjdXN0b21pemVyIFRoZSBmdW5jdGlvbiB0byBjdXN0b21pemUgYXNzaWduZWQgdmFsdWVzLlxuICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBgb2JqZWN0YC5cbiAqL1xuZnVuY3Rpb24gYXNzaWduV2l0aChvYmplY3QsIHNvdXJjZSwgY3VzdG9taXplcikge1xuICB2YXIgaW5kZXggPSAtMSxcbiAgICAgIHByb3BzID0ga2V5cyhzb3VyY2UpLFxuICAgICAgbGVuZ3RoID0gcHJvcHMubGVuZ3RoO1xuXG4gIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgdmFyIGtleSA9IHByb3BzW2luZGV4XSxcbiAgICAgICAgdmFsdWUgPSBvYmplY3Rba2V5XSxcbiAgICAgICAgcmVzdWx0ID0gY3VzdG9taXplcih2YWx1ZSwgc291cmNlW2tleV0sIGtleSwgb2JqZWN0LCBzb3VyY2UpO1xuXG4gICAgaWYgKChyZXN1bHQgPT09IHJlc3VsdCA/IChyZXN1bHQgIT09IHZhbHVlKSA6ICh2YWx1ZSA9PT0gdmFsdWUpKSB8fFxuICAgICAgICAodmFsdWUgPT09IHVuZGVmaW5lZCAmJiAhKGtleSBpbiBvYmplY3QpKSkge1xuICAgICAgb2JqZWN0W2tleV0gPSByZXN1bHQ7XG4gICAgfVxuICB9XG4gIHJldHVybiBvYmplY3Q7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYXNzaWduV2l0aDtcbiIsInZhciBiYXNlQ29weSA9IHJlcXVpcmUoJy4vYmFzZUNvcHknKSxcbiAgICBrZXlzID0gcmVxdWlyZSgnLi4vb2JqZWN0L2tleXMnKTtcblxuLyoqXG4gKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5hc3NpZ25gIHdpdGhvdXQgc3VwcG9ydCBmb3IgYXJndW1lbnQganVnZ2xpbmcsXG4gKiBtdWx0aXBsZSBzb3VyY2VzLCBhbmQgYGN1c3RvbWl6ZXJgIGZ1bmN0aW9ucy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgZGVzdGluYXRpb24gb2JqZWN0LlxuICogQHBhcmFtIHtPYmplY3R9IHNvdXJjZSBUaGUgc291cmNlIG9iamVjdC5cbiAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYG9iamVjdGAuXG4gKi9cbmZ1bmN0aW9uIGJhc2VBc3NpZ24ob2JqZWN0LCBzb3VyY2UpIHtcbiAgcmV0dXJuIHNvdXJjZSA9PSBudWxsXG4gICAgPyBvYmplY3RcbiAgICA6IGJhc2VDb3B5KHNvdXJjZSwga2V5cyhzb3VyY2UpLCBvYmplY3QpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJhc2VBc3NpZ247XG4iLCIvKipcbiAqIENvcGllcyBwcm9wZXJ0aWVzIG9mIGBzb3VyY2VgIHRvIGBvYmplY3RgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gc291cmNlIFRoZSBvYmplY3QgdG8gY29weSBwcm9wZXJ0aWVzIGZyb20uXG4gKiBAcGFyYW0ge0FycmF5fSBwcm9wcyBUaGUgcHJvcGVydHkgbmFtZXMgdG8gY29weS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbb2JqZWN0PXt9XSBUaGUgb2JqZWN0IHRvIGNvcHkgcHJvcGVydGllcyB0by5cbiAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYG9iamVjdGAuXG4gKi9cbmZ1bmN0aW9uIGJhc2VDb3B5KHNvdXJjZSwgcHJvcHMsIG9iamVjdCkge1xuICBvYmplY3QgfHwgKG9iamVjdCA9IHt9KTtcblxuICB2YXIgaW5kZXggPSAtMSxcbiAgICAgIGxlbmd0aCA9IHByb3BzLmxlbmd0aDtcblxuICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgIHZhciBrZXkgPSBwcm9wc1tpbmRleF07XG4gICAgb2JqZWN0W2tleV0gPSBzb3VyY2Vba2V5XTtcbiAgfVxuICByZXR1cm4gb2JqZWN0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJhc2VDb3B5O1xuIiwiLyoqXG4gKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5wcm9wZXJ0eWAgd2l0aG91dCBzdXBwb3J0IGZvciBkZWVwIHBhdGhzLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIHByb3BlcnR5IHRvIGdldC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBiYXNlUHJvcGVydHkoa2V5KSB7XG4gIHJldHVybiBmdW5jdGlvbihvYmplY3QpIHtcbiAgICByZXR1cm4gb2JqZWN0ID09IG51bGwgPyB1bmRlZmluZWQgOiBvYmplY3Rba2V5XTtcbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBiYXNlUHJvcGVydHk7XG4iLCJ2YXIgaWRlbnRpdHkgPSByZXF1aXJlKCcuLi91dGlsaXR5L2lkZW50aXR5Jyk7XG5cbi8qKlxuICogQSBzcGVjaWFsaXplZCB2ZXJzaW9uIG9mIGBiYXNlQ2FsbGJhY2tgIHdoaWNoIG9ubHkgc3VwcG9ydHMgYHRoaXNgIGJpbmRpbmdcbiAqIGFuZCBzcGVjaWZ5aW5nIHRoZSBudW1iZXIgb2YgYXJndW1lbnRzIHRvIHByb3ZpZGUgdG8gYGZ1bmNgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byBiaW5kLlxuICogQHBhcmFtIHsqfSB0aGlzQXJnIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgZnVuY2AuXG4gKiBAcGFyYW0ge251bWJlcn0gW2FyZ0NvdW50XSBUaGUgbnVtYmVyIG9mIGFyZ3VtZW50cyB0byBwcm92aWRlIHRvIGBmdW5jYC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgY2FsbGJhY2suXG4gKi9cbmZ1bmN0aW9uIGJpbmRDYWxsYmFjayhmdW5jLCB0aGlzQXJnLCBhcmdDb3VudCkge1xuICBpZiAodHlwZW9mIGZ1bmMgIT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBpZGVudGl0eTtcbiAgfVxuICBpZiAodGhpc0FyZyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIGZ1bmM7XG4gIH1cbiAgc3dpdGNoIChhcmdDb3VudCkge1xuICAgIGNhc2UgMTogcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICByZXR1cm4gZnVuYy5jYWxsKHRoaXNBcmcsIHZhbHVlKTtcbiAgICB9O1xuICAgIGNhc2UgMzogcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgcmV0dXJuIGZ1bmMuY2FsbCh0aGlzQXJnLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xuICAgIH07XG4gICAgY2FzZSA0OiByZXR1cm4gZnVuY3Rpb24oYWNjdW11bGF0b3IsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgcmV0dXJuIGZ1bmMuY2FsbCh0aGlzQXJnLCBhY2N1bXVsYXRvciwgdmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKTtcbiAgICB9O1xuICAgIGNhc2UgNTogcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBvdGhlciwga2V5LCBvYmplY3QsIHNvdXJjZSkge1xuICAgICAgcmV0dXJuIGZ1bmMuY2FsbCh0aGlzQXJnLCB2YWx1ZSwgb3RoZXIsIGtleSwgb2JqZWN0LCBzb3VyY2UpO1xuICAgIH07XG4gIH1cbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBmdW5jLmFwcGx5KHRoaXNBcmcsIGFyZ3VtZW50cyk7XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYmluZENhbGxiYWNrO1xuIiwidmFyIGJpbmRDYWxsYmFjayA9IHJlcXVpcmUoJy4vYmluZENhbGxiYWNrJyksXG4gICAgaXNJdGVyYXRlZUNhbGwgPSByZXF1aXJlKCcuL2lzSXRlcmF0ZWVDYWxsJyksXG4gICAgcmVzdFBhcmFtID0gcmVxdWlyZSgnLi4vZnVuY3Rpb24vcmVzdFBhcmFtJyk7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGBfLmFzc2lnbmAsIGBfLmRlZmF1bHRzYCwgb3IgYF8ubWVyZ2VgIGZ1bmN0aW9uLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBhc3NpZ25lciBUaGUgZnVuY3Rpb24gdG8gYXNzaWduIHZhbHVlcy5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGFzc2lnbmVyIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBjcmVhdGVBc3NpZ25lcihhc3NpZ25lcikge1xuICByZXR1cm4gcmVzdFBhcmFtKGZ1bmN0aW9uKG9iamVjdCwgc291cmNlcykge1xuICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBvYmplY3QgPT0gbnVsbCA/IDAgOiBzb3VyY2VzLmxlbmd0aCxcbiAgICAgICAgY3VzdG9taXplciA9IGxlbmd0aCA+IDIgPyBzb3VyY2VzW2xlbmd0aCAtIDJdIDogdW5kZWZpbmVkLFxuICAgICAgICBndWFyZCA9IGxlbmd0aCA+IDIgPyBzb3VyY2VzWzJdIDogdW5kZWZpbmVkLFxuICAgICAgICB0aGlzQXJnID0gbGVuZ3RoID4gMSA/IHNvdXJjZXNbbGVuZ3RoIC0gMV0gOiB1bmRlZmluZWQ7XG5cbiAgICBpZiAodHlwZW9mIGN1c3RvbWl6ZXIgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY3VzdG9taXplciA9IGJpbmRDYWxsYmFjayhjdXN0b21pemVyLCB0aGlzQXJnLCA1KTtcbiAgICAgIGxlbmd0aCAtPSAyO1xuICAgIH0gZWxzZSB7XG4gICAgICBjdXN0b21pemVyID0gdHlwZW9mIHRoaXNBcmcgPT0gJ2Z1bmN0aW9uJyA/IHRoaXNBcmcgOiB1bmRlZmluZWQ7XG4gICAgICBsZW5ndGggLT0gKGN1c3RvbWl6ZXIgPyAxIDogMCk7XG4gICAgfVxuICAgIGlmIChndWFyZCAmJiBpc0l0ZXJhdGVlQ2FsbChzb3VyY2VzWzBdLCBzb3VyY2VzWzFdLCBndWFyZCkpIHtcbiAgICAgIGN1c3RvbWl6ZXIgPSBsZW5ndGggPCAzID8gdW5kZWZpbmVkIDogY3VzdG9taXplcjtcbiAgICAgIGxlbmd0aCA9IDE7XG4gICAgfVxuICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICB2YXIgc291cmNlID0gc291cmNlc1tpbmRleF07XG4gICAgICBpZiAoc291cmNlKSB7XG4gICAgICAgIGFzc2lnbmVyKG9iamVjdCwgc291cmNlLCBjdXN0b21pemVyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9iamVjdDtcbiAgfSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlQXNzaWduZXI7XG4iLCJ2YXIgcmVzdFBhcmFtID0gcmVxdWlyZSgnLi4vZnVuY3Rpb24vcmVzdFBhcmFtJyk7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGBfLmRlZmF1bHRzYCBvciBgXy5kZWZhdWx0c0RlZXBgIGZ1bmN0aW9uLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBhc3NpZ25lciBUaGUgZnVuY3Rpb24gdG8gYXNzaWduIHZhbHVlcy5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGN1c3RvbWl6ZXIgVGhlIGZ1bmN0aW9uIHRvIGN1c3RvbWl6ZSBhc3NpZ25lZCB2YWx1ZXMuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBkZWZhdWx0cyBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlRGVmYXVsdHMoYXNzaWduZXIsIGN1c3RvbWl6ZXIpIHtcbiAgcmV0dXJuIHJlc3RQYXJhbShmdW5jdGlvbihhcmdzKSB7XG4gICAgdmFyIG9iamVjdCA9IGFyZ3NbMF07XG4gICAgaWYgKG9iamVjdCA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gb2JqZWN0O1xuICAgIH1cbiAgICBhcmdzLnB1c2goY3VzdG9taXplcik7XG4gICAgcmV0dXJuIGFzc2lnbmVyLmFwcGx5KHVuZGVmaW5lZCwgYXJncyk7XG4gIH0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZURlZmF1bHRzO1xuIiwidmFyIGJhc2VQcm9wZXJ0eSA9IHJlcXVpcmUoJy4vYmFzZVByb3BlcnR5Jyk7XG5cbi8qKlxuICogR2V0cyB0aGUgXCJsZW5ndGhcIiBwcm9wZXJ0eSB2YWx1ZSBvZiBgb2JqZWN0YC5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBmdW5jdGlvbiBpcyB1c2VkIHRvIGF2b2lkIGEgW0pJVCBidWddKGh0dHBzOi8vYnVncy53ZWJraXQub3JnL3Nob3dfYnVnLmNnaT9pZD0xNDI3OTIpXG4gKiB0aGF0IGFmZmVjdHMgU2FmYXJpIG9uIGF0IGxlYXN0IGlPUyA4LjEtOC4zIEFSTTY0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgXCJsZW5ndGhcIiB2YWx1ZS5cbiAqL1xudmFyIGdldExlbmd0aCA9IGJhc2VQcm9wZXJ0eSgnbGVuZ3RoJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0TGVuZ3RoO1xuIiwidmFyIGlzTmF0aXZlID0gcmVxdWlyZSgnLi4vbGFuZy9pc05hdGl2ZScpO1xuXG4vKipcbiAqIEdldHMgdGhlIG5hdGl2ZSBmdW5jdGlvbiBhdCBga2V5YCBvZiBgb2JqZWN0YC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IG9mIHRoZSBtZXRob2QgdG8gZ2V0LlxuICogQHJldHVybnMgeyp9IFJldHVybnMgdGhlIGZ1bmN0aW9uIGlmIGl0J3MgbmF0aXZlLCBlbHNlIGB1bmRlZmluZWRgLlxuICovXG5mdW5jdGlvbiBnZXROYXRpdmUob2JqZWN0LCBrZXkpIHtcbiAgdmFyIHZhbHVlID0gb2JqZWN0ID09IG51bGwgPyB1bmRlZmluZWQgOiBvYmplY3Rba2V5XTtcbiAgcmV0dXJuIGlzTmF0aXZlKHZhbHVlKSA/IHZhbHVlIDogdW5kZWZpbmVkO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldE5hdGl2ZTtcbiIsInZhciBnZXRMZW5ndGggPSByZXF1aXJlKCcuL2dldExlbmd0aCcpLFxuICAgIGlzTGVuZ3RoID0gcmVxdWlyZSgnLi9pc0xlbmd0aCcpO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGFycmF5LWxpa2UuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYXJyYXktbGlrZSwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc0FycmF5TGlrZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgIT0gbnVsbCAmJiBpc0xlbmd0aChnZXRMZW5ndGgodmFsdWUpKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0FycmF5TGlrZTtcbiIsIi8qKiBVc2VkIHRvIGRldGVjdCB1bnNpZ25lZCBpbnRlZ2VyIHZhbHVlcy4gKi9cbnZhciByZUlzVWludCA9IC9eXFxkKyQvO1xuXG4vKipcbiAqIFVzZWQgYXMgdGhlIFttYXhpbXVtIGxlbmd0aF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtbnVtYmVyLm1heF9zYWZlX2ludGVnZXIpXG4gKiBvZiBhbiBhcnJheS1saWtlIHZhbHVlLlxuICovXG52YXIgTUFYX1NBRkVfSU5URUdFUiA9IDkwMDcxOTkyNTQ3NDA5OTE7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBhcnJheS1saWtlIGluZGV4LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbbGVuZ3RoPU1BWF9TQUZFX0lOVEVHRVJdIFRoZSB1cHBlciBib3VuZHMgb2YgYSB2YWxpZCBpbmRleC5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgaW5kZXgsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNJbmRleCh2YWx1ZSwgbGVuZ3RoKSB7XG4gIHZhbHVlID0gKHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyB8fCByZUlzVWludC50ZXN0KHZhbHVlKSkgPyArdmFsdWUgOiAtMTtcbiAgbGVuZ3RoID0gbGVuZ3RoID09IG51bGwgPyBNQVhfU0FGRV9JTlRFR0VSIDogbGVuZ3RoO1xuICByZXR1cm4gdmFsdWUgPiAtMSAmJiB2YWx1ZSAlIDEgPT0gMCAmJiB2YWx1ZSA8IGxlbmd0aDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0luZGV4O1xuIiwidmFyIGlzQXJyYXlMaWtlID0gcmVxdWlyZSgnLi9pc0FycmF5TGlrZScpLFxuICAgIGlzSW5kZXggPSByZXF1aXJlKCcuL2lzSW5kZXgnKSxcbiAgICBpc09iamVjdCA9IHJlcXVpcmUoJy4uL2xhbmcvaXNPYmplY3QnKTtcblxuLyoqXG4gKiBDaGVja3MgaWYgdGhlIHByb3ZpZGVkIGFyZ3VtZW50cyBhcmUgZnJvbSBhbiBpdGVyYXRlZSBjYWxsLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSBwb3RlbnRpYWwgaXRlcmF0ZWUgdmFsdWUgYXJndW1lbnQuXG4gKiBAcGFyYW0geyp9IGluZGV4IFRoZSBwb3RlbnRpYWwgaXRlcmF0ZWUgaW5kZXggb3Iga2V5IGFyZ3VtZW50LlxuICogQHBhcmFtIHsqfSBvYmplY3QgVGhlIHBvdGVudGlhbCBpdGVyYXRlZSBvYmplY3QgYXJndW1lbnQuXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGFyZ3VtZW50cyBhcmUgZnJvbSBhbiBpdGVyYXRlZSBjYWxsLCBlbHNlIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIGlzSXRlcmF0ZWVDYWxsKHZhbHVlLCBpbmRleCwgb2JqZWN0KSB7XG4gIGlmICghaXNPYmplY3Qob2JqZWN0KSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB2YXIgdHlwZSA9IHR5cGVvZiBpbmRleDtcbiAgaWYgKHR5cGUgPT0gJ251bWJlcidcbiAgICAgID8gKGlzQXJyYXlMaWtlKG9iamVjdCkgJiYgaXNJbmRleChpbmRleCwgb2JqZWN0Lmxlbmd0aCkpXG4gICAgICA6ICh0eXBlID09ICdzdHJpbmcnICYmIGluZGV4IGluIG9iamVjdCkpIHtcbiAgICB2YXIgb3RoZXIgPSBvYmplY3RbaW5kZXhdO1xuICAgIHJldHVybiB2YWx1ZSA9PT0gdmFsdWUgPyAodmFsdWUgPT09IG90aGVyKSA6IChvdGhlciAhPT0gb3RoZXIpO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0l0ZXJhdGVlQ2FsbDtcbiIsIi8qKlxuICogVXNlZCBhcyB0aGUgW21heGltdW0gbGVuZ3RoXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1udW1iZXIubWF4X3NhZmVfaW50ZWdlcilcbiAqIG9mIGFuIGFycmF5LWxpa2UgdmFsdWUuXG4gKi9cbnZhciBNQVhfU0FGRV9JTlRFR0VSID0gOTAwNzE5OTI1NDc0MDk5MTtcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGFycmF5LWxpa2UgbGVuZ3RoLlxuICpcbiAqICoqTm90ZToqKiBUaGlzIGZ1bmN0aW9uIGlzIGJhc2VkIG9uIFtgVG9MZW5ndGhgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy10b2xlbmd0aCkuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBsZW5ndGgsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNMZW5ndGgodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyAmJiB2YWx1ZSA+IC0xICYmIHZhbHVlICUgMSA9PSAwICYmIHZhbHVlIDw9IE1BWF9TQUZFX0lOVEVHRVI7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNMZW5ndGg7XG4iLCIvKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIG9iamVjdC1saWtlLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIG9iamVjdC1saWtlLCBlbHNlIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0TGlrZSh2YWx1ZSkge1xuICByZXR1cm4gISF2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCc7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNPYmplY3RMaWtlO1xuIiwidmFyIGlzQXJndW1lbnRzID0gcmVxdWlyZSgnLi4vbGFuZy9pc0FyZ3VtZW50cycpLFxuICAgIGlzQXJyYXkgPSByZXF1aXJlKCcuLi9sYW5nL2lzQXJyYXknKSxcbiAgICBpc0luZGV4ID0gcmVxdWlyZSgnLi9pc0luZGV4JyksXG4gICAgaXNMZW5ndGggPSByZXF1aXJlKCcuL2lzTGVuZ3RoJyksXG4gICAga2V5c0luID0gcmVxdWlyZSgnLi4vb2JqZWN0L2tleXNJbicpO1xuXG4vKiogVXNlZCBmb3IgbmF0aXZlIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIG9iamVjdFByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcblxuLyoqIFVzZWQgdG8gY2hlY2sgb2JqZWN0cyBmb3Igb3duIHByb3BlcnRpZXMuICovXG52YXIgaGFzT3duUHJvcGVydHkgPSBvYmplY3RQcm90by5oYXNPd25Qcm9wZXJ0eTtcblxuLyoqXG4gKiBBIGZhbGxiYWNrIGltcGxlbWVudGF0aW9uIG9mIGBPYmplY3Qua2V5c2Agd2hpY2ggY3JlYXRlcyBhbiBhcnJheSBvZiB0aGVcbiAqIG93biBlbnVtZXJhYmxlIHByb3BlcnR5IG5hbWVzIG9mIGBvYmplY3RgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgdGhlIGFycmF5IG9mIHByb3BlcnR5IG5hbWVzLlxuICovXG5mdW5jdGlvbiBzaGltS2V5cyhvYmplY3QpIHtcbiAgdmFyIHByb3BzID0ga2V5c0luKG9iamVjdCksXG4gICAgICBwcm9wc0xlbmd0aCA9IHByb3BzLmxlbmd0aCxcbiAgICAgIGxlbmd0aCA9IHByb3BzTGVuZ3RoICYmIG9iamVjdC5sZW5ndGg7XG5cbiAgdmFyIGFsbG93SW5kZXhlcyA9ICEhbGVuZ3RoICYmIGlzTGVuZ3RoKGxlbmd0aCkgJiZcbiAgICAoaXNBcnJheShvYmplY3QpIHx8IGlzQXJndW1lbnRzKG9iamVjdCkpO1xuXG4gIHZhciBpbmRleCA9IC0xLFxuICAgICAgcmVzdWx0ID0gW107XG5cbiAgd2hpbGUgKCsraW5kZXggPCBwcm9wc0xlbmd0aCkge1xuICAgIHZhciBrZXkgPSBwcm9wc1tpbmRleF07XG4gICAgaWYgKChhbGxvd0luZGV4ZXMgJiYgaXNJbmRleChrZXksIGxlbmd0aCkpIHx8IGhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBrZXkpKSB7XG4gICAgICByZXN1bHQucHVzaChrZXkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHNoaW1LZXlzO1xuIiwidmFyIGlzQXJyYXlMaWtlID0gcmVxdWlyZSgnLi4vaW50ZXJuYWwvaXNBcnJheUxpa2UnKSxcbiAgICBpc09iamVjdExpa2UgPSByZXF1aXJlKCcuLi9pbnRlcm5hbC9pc09iamVjdExpa2UnKTtcblxuLyoqIFVzZWQgZm9yIG5hdGl2ZSBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKiBVc2VkIHRvIGNoZWNrIG9iamVjdHMgZm9yIG93biBwcm9wZXJ0aWVzLiAqL1xudmFyIGhhc093blByb3BlcnR5ID0gb2JqZWN0UHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbi8qKiBOYXRpdmUgbWV0aG9kIHJlZmVyZW5jZXMuICovXG52YXIgcHJvcGVydHlJc0VudW1lcmFibGUgPSBvYmplY3RQcm90by5wcm9wZXJ0eUlzRW51bWVyYWJsZTtcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBjbGFzc2lmaWVkIGFzIGFuIGBhcmd1bWVudHNgIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgY29ycmVjdGx5IGNsYXNzaWZpZWQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0FyZ3VtZW50cyhmdW5jdGlvbigpIHsgcmV0dXJuIGFyZ3VtZW50czsgfSgpKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJndW1lbnRzKFsxLCAyLCAzXSk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0FyZ3VtZW50cyh2YWx1ZSkge1xuICByZXR1cm4gaXNPYmplY3RMaWtlKHZhbHVlKSAmJiBpc0FycmF5TGlrZSh2YWx1ZSkgJiZcbiAgICBoYXNPd25Qcm9wZXJ0eS5jYWxsKHZhbHVlLCAnY2FsbGVlJykgJiYgIXByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwodmFsdWUsICdjYWxsZWUnKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0FyZ3VtZW50cztcbiIsInZhciBnZXROYXRpdmUgPSByZXF1aXJlKCcuLi9pbnRlcm5hbC9nZXROYXRpdmUnKSxcbiAgICBpc0xlbmd0aCA9IHJlcXVpcmUoJy4uL2ludGVybmFsL2lzTGVuZ3RoJyksXG4gICAgaXNPYmplY3RMaWtlID0gcmVxdWlyZSgnLi4vaW50ZXJuYWwvaXNPYmplY3RMaWtlJyk7XG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBhcnJheVRhZyA9ICdbb2JqZWN0IEFycmF5XSc7XG5cbi8qKiBVc2VkIGZvciBuYXRpdmUgbWV0aG9kIHJlZmVyZW5jZXMuICovXG52YXIgb2JqZWN0UHJvdG8gPSBPYmplY3QucHJvdG90eXBlO1xuXG4vKipcbiAqIFVzZWQgdG8gcmVzb2x2ZSB0aGUgW2B0b1N0cmluZ1RhZ2BdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLW9iamVjdC5wcm90b3R5cGUudG9zdHJpbmcpXG4gKiBvZiB2YWx1ZXMuXG4gKi9cbnZhciBvYmpUb1N0cmluZyA9IG9iamVjdFByb3RvLnRvU3RyaW5nO1xuXG4vKiBOYXRpdmUgbWV0aG9kIHJlZmVyZW5jZXMgZm9yIHRob3NlIHdpdGggdGhlIHNhbWUgbmFtZSBhcyBvdGhlciBgbG9kYXNoYCBtZXRob2RzLiAqL1xudmFyIG5hdGl2ZUlzQXJyYXkgPSBnZXROYXRpdmUoQXJyYXksICdpc0FycmF5Jyk7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhbiBgQXJyYXlgIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgY29ycmVjdGx5IGNsYXNzaWZpZWQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0FycmF5KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0FycmF5KGZ1bmN0aW9uKCkgeyByZXR1cm4gYXJndW1lbnRzOyB9KCkpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xudmFyIGlzQXJyYXkgPSBuYXRpdmVJc0FycmF5IHx8IGZ1bmN0aW9uKHZhbHVlKSB7XG4gIHJldHVybiBpc09iamVjdExpa2UodmFsdWUpICYmIGlzTGVuZ3RoKHZhbHVlLmxlbmd0aCkgJiYgb2JqVG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gYXJyYXlUYWc7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGlzQXJyYXk7XG4iLCJ2YXIgaXNPYmplY3QgPSByZXF1aXJlKCcuL2lzT2JqZWN0Jyk7XG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBmdW5jVGFnID0gJ1tvYmplY3QgRnVuY3Rpb25dJztcblxuLyoqIFVzZWQgZm9yIG5hdGl2ZSBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKlxuICogVXNlZCB0byByZXNvbHZlIHRoZSBbYHRvU3RyaW5nVGFnYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtb2JqZWN0LnByb3RvdHlwZS50b3N0cmluZylcbiAqIG9mIHZhbHVlcy5cbiAqL1xudmFyIG9ialRvU3RyaW5nID0gb2JqZWN0UHJvdG8udG9TdHJpbmc7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhIGBGdW5jdGlvbmAgb2JqZWN0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBjb3JyZWN0bHkgY2xhc3NpZmllZCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oXyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0Z1bmN0aW9uKC9hYmMvKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRnVuY3Rpb24odmFsdWUpIHtcbiAgLy8gVGhlIHVzZSBvZiBgT2JqZWN0I3RvU3RyaW5nYCBhdm9pZHMgaXNzdWVzIHdpdGggdGhlIGB0eXBlb2ZgIG9wZXJhdG9yXG4gIC8vIGluIG9sZGVyIHZlcnNpb25zIG9mIENocm9tZSBhbmQgU2FmYXJpIHdoaWNoIHJldHVybiAnZnVuY3Rpb24nIGZvciByZWdleGVzXG4gIC8vIGFuZCBTYWZhcmkgOCB3aGljaCByZXR1cm5zICdvYmplY3QnIGZvciB0eXBlZCBhcnJheSBjb25zdHJ1Y3RvcnMuXG4gIHJldHVybiBpc09iamVjdCh2YWx1ZSkgJiYgb2JqVG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gZnVuY1RhZztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0Z1bmN0aW9uO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKCcuL2lzRnVuY3Rpb24nKSxcbiAgICBpc09iamVjdExpa2UgPSByZXF1aXJlKCcuLi9pbnRlcm5hbC9pc09iamVjdExpa2UnKTtcblxuLyoqIFVzZWQgdG8gZGV0ZWN0IGhvc3QgY29uc3RydWN0b3JzIChTYWZhcmkgPiA1KS4gKi9cbnZhciByZUlzSG9zdEN0b3IgPSAvXlxcW29iamVjdCAuKz9Db25zdHJ1Y3RvclxcXSQvO1xuXG4vKiogVXNlZCBmb3IgbmF0aXZlIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIG9iamVjdFByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcblxuLyoqIFVzZWQgdG8gcmVzb2x2ZSB0aGUgZGVjb21waWxlZCBzb3VyY2Ugb2YgZnVuY3Rpb25zLiAqL1xudmFyIGZuVG9TdHJpbmcgPSBGdW5jdGlvbi5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKiBVc2VkIHRvIGNoZWNrIG9iamVjdHMgZm9yIG93biBwcm9wZXJ0aWVzLiAqL1xudmFyIGhhc093blByb3BlcnR5ID0gb2JqZWN0UHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCBpZiBhIG1ldGhvZCBpcyBuYXRpdmUuICovXG52YXIgcmVJc05hdGl2ZSA9IFJlZ0V4cCgnXicgK1xuICBmblRvU3RyaW5nLmNhbGwoaGFzT3duUHJvcGVydHkpLnJlcGxhY2UoL1tcXFxcXiQuKis/KClbXFxde318XS9nLCAnXFxcXCQmJylcbiAgLnJlcGxhY2UoL2hhc093blByb3BlcnR5fChmdW5jdGlvbikuKj8oPz1cXFxcXFwoKXwgZm9yIC4rPyg/PVxcXFxcXF0pL2csICckMS4qPycpICsgJyQnXG4pO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgbmF0aXZlIGZ1bmN0aW9uLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIG5hdGl2ZSBmdW5jdGlvbiwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzTmF0aXZlKEFycmF5LnByb3RvdHlwZS5wdXNoKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzTmF0aXZlKF8pO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNOYXRpdmUodmFsdWUpIHtcbiAgaWYgKHZhbHVlID09IG51bGwpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgcmV0dXJuIHJlSXNOYXRpdmUudGVzdChmblRvU3RyaW5nLmNhbGwodmFsdWUpKTtcbiAgfVxuICByZXR1cm4gaXNPYmplY3RMaWtlKHZhbHVlKSAmJiByZUlzSG9zdEN0b3IudGVzdCh2YWx1ZSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNOYXRpdmU7XG4iLCJ2YXIgaXNPYmplY3RMaWtlID0gcmVxdWlyZSgnLi4vaW50ZXJuYWwvaXNPYmplY3RMaWtlJyk7XG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBudW1iZXJUYWcgPSAnW29iamVjdCBOdW1iZXJdJztcblxuLyoqIFVzZWQgZm9yIG5hdGl2ZSBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKlxuICogVXNlZCB0byByZXNvbHZlIHRoZSBbYHRvU3RyaW5nVGFnYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtb2JqZWN0LnByb3RvdHlwZS50b3N0cmluZylcbiAqIG9mIHZhbHVlcy5cbiAqL1xudmFyIG9ialRvU3RyaW5nID0gb2JqZWN0UHJvdG8udG9TdHJpbmc7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhIGBOdW1iZXJgIHByaW1pdGl2ZSBvciBvYmplY3QuXG4gKlxuICogKipOb3RlOioqIFRvIGV4Y2x1ZGUgYEluZmluaXR5YCwgYC1JbmZpbml0eWAsIGFuZCBgTmFOYCwgd2hpY2ggYXJlIGNsYXNzaWZpZWRcbiAqIGFzIG51bWJlcnMsIHVzZSB0aGUgYF8uaXNGaW5pdGVgIG1ldGhvZC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgY29ycmVjdGx5IGNsYXNzaWZpZWQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc051bWJlcig4LjQpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNOdW1iZXIoTmFOKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzTnVtYmVyKCc4LjQnKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzTnVtYmVyKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT0gJ251bWJlcicgfHwgKGlzT2JqZWN0TGlrZSh2YWx1ZSkgJiYgb2JqVG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gbnVtYmVyVGFnKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc051bWJlcjtcbiIsIi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgdGhlIFtsYW5ndWFnZSB0eXBlXShodHRwczovL2VzNS5naXRodWIuaW8vI3g4KSBvZiBgT2JqZWN0YC5cbiAqIChlLmcuIGFycmF5cywgZnVuY3Rpb25zLCBvYmplY3RzLCByZWdleGVzLCBgbmV3IE51bWJlcigwKWAsIGFuZCBgbmV3IFN0cmluZygnJylgKVxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhbiBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc09iamVjdCh7fSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoMSk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICAvLyBBdm9pZCBhIFY4IEpJVCBidWcgaW4gQ2hyb21lIDE5LTIwLlxuICAvLyBTZWUgaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTIyOTEgZm9yIG1vcmUgZGV0YWlscy5cbiAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsdWU7XG4gIHJldHVybiAhIXZhbHVlICYmICh0eXBlID09ICdvYmplY3QnIHx8IHR5cGUgPT0gJ2Z1bmN0aW9uJyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNPYmplY3Q7XG4iLCJ2YXIgaXNPYmplY3RMaWtlID0gcmVxdWlyZSgnLi4vaW50ZXJuYWwvaXNPYmplY3RMaWtlJyk7XG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBzdHJpbmdUYWcgPSAnW29iamVjdCBTdHJpbmddJztcblxuLyoqIFVzZWQgZm9yIG5hdGl2ZSBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKlxuICogVXNlZCB0byByZXNvbHZlIHRoZSBbYHRvU3RyaW5nVGFnYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtb2JqZWN0LnByb3RvdHlwZS50b3N0cmluZylcbiAqIG9mIHZhbHVlcy5cbiAqL1xudmFyIG9ialRvU3RyaW5nID0gb2JqZWN0UHJvdG8udG9TdHJpbmc7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhIGBTdHJpbmdgIHByaW1pdGl2ZSBvciBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGNvcnJlY3RseSBjbGFzc2lmaWVkLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNTdHJpbmcoJ2FiYycpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNTdHJpbmcoMSk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc1N0cmluZyh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdzdHJpbmcnIHx8IChpc09iamVjdExpa2UodmFsdWUpICYmIG9ialRvU3RyaW5nLmNhbGwodmFsdWUpID09IHN0cmluZ1RhZyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNTdHJpbmc7XG4iLCJ2YXIgYXNzaWduV2l0aCA9IHJlcXVpcmUoJy4uL2ludGVybmFsL2Fzc2lnbldpdGgnKSxcbiAgICBiYXNlQXNzaWduID0gcmVxdWlyZSgnLi4vaW50ZXJuYWwvYmFzZUFzc2lnbicpLFxuICAgIGNyZWF0ZUFzc2lnbmVyID0gcmVxdWlyZSgnLi4vaW50ZXJuYWwvY3JlYXRlQXNzaWduZXInKTtcblxuLyoqXG4gKiBBc3NpZ25zIG93biBlbnVtZXJhYmxlIHByb3BlcnRpZXMgb2Ygc291cmNlIG9iamVjdChzKSB0byB0aGUgZGVzdGluYXRpb25cbiAqIG9iamVjdC4gU3Vic2VxdWVudCBzb3VyY2VzIG92ZXJ3cml0ZSBwcm9wZXJ0eSBhc3NpZ25tZW50cyBvZiBwcmV2aW91cyBzb3VyY2VzLlxuICogSWYgYGN1c3RvbWl6ZXJgIGlzIHByb3ZpZGVkIGl0J3MgaW52b2tlZCB0byBwcm9kdWNlIHRoZSBhc3NpZ25lZCB2YWx1ZXMuXG4gKiBUaGUgYGN1c3RvbWl6ZXJgIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIGZpdmUgYXJndW1lbnRzOlxuICogKG9iamVjdFZhbHVlLCBzb3VyY2VWYWx1ZSwga2V5LCBvYmplY3QsIHNvdXJjZSkuXG4gKlxuICogKipOb3RlOioqIFRoaXMgbWV0aG9kIG11dGF0ZXMgYG9iamVjdGAgYW5kIGlzIGJhc2VkIG9uXG4gKiBbYE9iamVjdC5hc3NpZ25gXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1vYmplY3QuYXNzaWduKS5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGFsaWFzIGV4dGVuZFxuICogQGNhdGVnb3J5IE9iamVjdFxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgZGVzdGluYXRpb24gb2JqZWN0LlxuICogQHBhcmFtIHsuLi5PYmplY3R9IFtzb3VyY2VzXSBUaGUgc291cmNlIG9iamVjdHMuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY3VzdG9taXplcl0gVGhlIGZ1bmN0aW9uIHRvIGN1c3RvbWl6ZSBhc3NpZ25lZCB2YWx1ZXMuXG4gKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGN1c3RvbWl6ZXJgLlxuICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBgb2JqZWN0YC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5hc3NpZ24oeyAndXNlcic6ICdiYXJuZXknIH0sIHsgJ2FnZSc6IDQwIH0sIHsgJ3VzZXInOiAnZnJlZCcgfSk7XG4gKiAvLyA9PiB7ICd1c2VyJzogJ2ZyZWQnLCAnYWdlJzogNDAgfVxuICpcbiAqIC8vIHVzaW5nIGEgY3VzdG9taXplciBjYWxsYmFja1xuICogdmFyIGRlZmF1bHRzID0gXy5wYXJ0aWFsUmlnaHQoXy5hc3NpZ24sIGZ1bmN0aW9uKHZhbHVlLCBvdGhlcikge1xuICogICByZXR1cm4gXy5pc1VuZGVmaW5lZCh2YWx1ZSkgPyBvdGhlciA6IHZhbHVlO1xuICogfSk7XG4gKlxuICogZGVmYXVsdHMoeyAndXNlcic6ICdiYXJuZXknIH0sIHsgJ2FnZSc6IDM2IH0sIHsgJ3VzZXInOiAnZnJlZCcgfSk7XG4gKiAvLyA9PiB7ICd1c2VyJzogJ2Jhcm5leScsICdhZ2UnOiAzNiB9XG4gKi9cbnZhciBhc3NpZ24gPSBjcmVhdGVBc3NpZ25lcihmdW5jdGlvbihvYmplY3QsIHNvdXJjZSwgY3VzdG9taXplcikge1xuICByZXR1cm4gY3VzdG9taXplclxuICAgID8gYXNzaWduV2l0aChvYmplY3QsIHNvdXJjZSwgY3VzdG9taXplcilcbiAgICA6IGJhc2VBc3NpZ24ob2JqZWN0LCBzb3VyY2UpO1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gYXNzaWduO1xuIiwidmFyIGFzc2lnbiA9IHJlcXVpcmUoJy4vYXNzaWduJyksXG4gICAgYXNzaWduRGVmYXVsdHMgPSByZXF1aXJlKCcuLi9pbnRlcm5hbC9hc3NpZ25EZWZhdWx0cycpLFxuICAgIGNyZWF0ZURlZmF1bHRzID0gcmVxdWlyZSgnLi4vaW50ZXJuYWwvY3JlYXRlRGVmYXVsdHMnKTtcblxuLyoqXG4gKiBBc3NpZ25zIG93biBlbnVtZXJhYmxlIHByb3BlcnRpZXMgb2Ygc291cmNlIG9iamVjdChzKSB0byB0aGUgZGVzdGluYXRpb25cbiAqIG9iamVjdCBmb3IgYWxsIGRlc3RpbmF0aW9uIHByb3BlcnRpZXMgdGhhdCByZXNvbHZlIHRvIGB1bmRlZmluZWRgLiBPbmNlIGFcbiAqIHByb3BlcnR5IGlzIHNldCwgYWRkaXRpb25hbCB2YWx1ZXMgb2YgdGhlIHNhbWUgcHJvcGVydHkgYXJlIGlnbm9yZWQuXG4gKlxuICogKipOb3RlOioqIFRoaXMgbWV0aG9kIG11dGF0ZXMgYG9iamVjdGAuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBPYmplY3RcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAqIEBwYXJhbSB7Li4uT2JqZWN0fSBbc291cmNlc10gVGhlIHNvdXJjZSBvYmplY3RzLlxuICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBgb2JqZWN0YC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5kZWZhdWx0cyh7ICd1c2VyJzogJ2Jhcm5leScgfSwgeyAnYWdlJzogMzYgfSwgeyAndXNlcic6ICdmcmVkJyB9KTtcbiAqIC8vID0+IHsgJ3VzZXInOiAnYmFybmV5JywgJ2FnZSc6IDM2IH1cbiAqL1xudmFyIGRlZmF1bHRzID0gY3JlYXRlRGVmYXVsdHMoYXNzaWduLCBhc3NpZ25EZWZhdWx0cyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZGVmYXVsdHM7XG4iLCJ2YXIgZ2V0TmF0aXZlID0gcmVxdWlyZSgnLi4vaW50ZXJuYWwvZ2V0TmF0aXZlJyksXG4gICAgaXNBcnJheUxpa2UgPSByZXF1aXJlKCcuLi9pbnRlcm5hbC9pc0FycmF5TGlrZScpLFxuICAgIGlzT2JqZWN0ID0gcmVxdWlyZSgnLi4vbGFuZy9pc09iamVjdCcpLFxuICAgIHNoaW1LZXlzID0gcmVxdWlyZSgnLi4vaW50ZXJuYWwvc2hpbUtleXMnKTtcblxuLyogTmF0aXZlIG1ldGhvZCByZWZlcmVuY2VzIGZvciB0aG9zZSB3aXRoIHRoZSBzYW1lIG5hbWUgYXMgb3RoZXIgYGxvZGFzaGAgbWV0aG9kcy4gKi9cbnZhciBuYXRpdmVLZXlzID0gZ2V0TmF0aXZlKE9iamVjdCwgJ2tleXMnKTtcblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFycmF5IG9mIHRoZSBvd24gZW51bWVyYWJsZSBwcm9wZXJ0eSBuYW1lcyBvZiBgb2JqZWN0YC5cbiAqXG4gKiAqKk5vdGU6KiogTm9uLW9iamVjdCB2YWx1ZXMgYXJlIGNvZXJjZWQgdG8gb2JqZWN0cy4gU2VlIHRoZVxuICogW0VTIHNwZWNdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLW9iamVjdC5rZXlzKVxuICogZm9yIG1vcmUgZGV0YWlscy5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IE9iamVjdFxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIHRoZSBhcnJheSBvZiBwcm9wZXJ0eSBuYW1lcy5cbiAqIEBleGFtcGxlXG4gKlxuICogZnVuY3Rpb24gRm9vKCkge1xuICogICB0aGlzLmEgPSAxO1xuICogICB0aGlzLmIgPSAyO1xuICogfVxuICpcbiAqIEZvby5wcm90b3R5cGUuYyA9IDM7XG4gKlxuICogXy5rZXlzKG5ldyBGb28pO1xuICogLy8gPT4gWydhJywgJ2InXSAoaXRlcmF0aW9uIG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkKVxuICpcbiAqIF8ua2V5cygnaGknKTtcbiAqIC8vID0+IFsnMCcsICcxJ11cbiAqL1xudmFyIGtleXMgPSAhbmF0aXZlS2V5cyA/IHNoaW1LZXlzIDogZnVuY3Rpb24ob2JqZWN0KSB7XG4gIHZhciBDdG9yID0gb2JqZWN0ID09IG51bGwgPyB1bmRlZmluZWQgOiBvYmplY3QuY29uc3RydWN0b3I7XG4gIGlmICgodHlwZW9mIEN0b3IgPT0gJ2Z1bmN0aW9uJyAmJiBDdG9yLnByb3RvdHlwZSA9PT0gb2JqZWN0KSB8fFxuICAgICAgKHR5cGVvZiBvYmplY3QgIT0gJ2Z1bmN0aW9uJyAmJiBpc0FycmF5TGlrZShvYmplY3QpKSkge1xuICAgIHJldHVybiBzaGltS2V5cyhvYmplY3QpO1xuICB9XG4gIHJldHVybiBpc09iamVjdChvYmplY3QpID8gbmF0aXZlS2V5cyhvYmplY3QpIDogW107XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGtleXM7XG4iLCJ2YXIgaXNBcmd1bWVudHMgPSByZXF1aXJlKCcuLi9sYW5nL2lzQXJndW1lbnRzJyksXG4gICAgaXNBcnJheSA9IHJlcXVpcmUoJy4uL2xhbmcvaXNBcnJheScpLFxuICAgIGlzSW5kZXggPSByZXF1aXJlKCcuLi9pbnRlcm5hbC9pc0luZGV4JyksXG4gICAgaXNMZW5ndGggPSByZXF1aXJlKCcuLi9pbnRlcm5hbC9pc0xlbmd0aCcpLFxuICAgIGlzT2JqZWN0ID0gcmVxdWlyZSgnLi4vbGFuZy9pc09iamVjdCcpO1xuXG4vKiogVXNlZCBmb3IgbmF0aXZlIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIG9iamVjdFByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcblxuLyoqIFVzZWQgdG8gY2hlY2sgb2JqZWN0cyBmb3Igb3duIHByb3BlcnRpZXMuICovXG52YXIgaGFzT3duUHJvcGVydHkgPSBvYmplY3RQcm90by5oYXNPd25Qcm9wZXJ0eTtcblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFycmF5IG9mIHRoZSBvd24gYW5kIGluaGVyaXRlZCBlbnVtZXJhYmxlIHByb3BlcnR5IG5hbWVzIG9mIGBvYmplY3RgLlxuICpcbiAqICoqTm90ZToqKiBOb24tb2JqZWN0IHZhbHVlcyBhcmUgY29lcmNlZCB0byBvYmplY3RzLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgT2JqZWN0XG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgdGhlIGFycmF5IG9mIHByb3BlcnR5IG5hbWVzLlxuICogQGV4YW1wbGVcbiAqXG4gKiBmdW5jdGlvbiBGb28oKSB7XG4gKiAgIHRoaXMuYSA9IDE7XG4gKiAgIHRoaXMuYiA9IDI7XG4gKiB9XG4gKlxuICogRm9vLnByb3RvdHlwZS5jID0gMztcbiAqXG4gKiBfLmtleXNJbihuZXcgRm9vKTtcbiAqIC8vID0+IFsnYScsICdiJywgJ2MnXSAoaXRlcmF0aW9uIG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkKVxuICovXG5mdW5jdGlvbiBrZXlzSW4ob2JqZWN0KSB7XG4gIGlmIChvYmplY3QgPT0gbnVsbCkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuICBpZiAoIWlzT2JqZWN0KG9iamVjdCkpIHtcbiAgICBvYmplY3QgPSBPYmplY3Qob2JqZWN0KTtcbiAgfVxuICB2YXIgbGVuZ3RoID0gb2JqZWN0Lmxlbmd0aDtcbiAgbGVuZ3RoID0gKGxlbmd0aCAmJiBpc0xlbmd0aChsZW5ndGgpICYmXG4gICAgKGlzQXJyYXkob2JqZWN0KSB8fCBpc0FyZ3VtZW50cyhvYmplY3QpKSAmJiBsZW5ndGgpIHx8IDA7XG5cbiAgdmFyIEN0b3IgPSBvYmplY3QuY29uc3RydWN0b3IsXG4gICAgICBpbmRleCA9IC0xLFxuICAgICAgaXNQcm90byA9IHR5cGVvZiBDdG9yID09ICdmdW5jdGlvbicgJiYgQ3Rvci5wcm90b3R5cGUgPT09IG9iamVjdCxcbiAgICAgIHJlc3VsdCA9IEFycmF5KGxlbmd0aCksXG4gICAgICBza2lwSW5kZXhlcyA9IGxlbmd0aCA+IDA7XG5cbiAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICByZXN1bHRbaW5kZXhdID0gKGluZGV4ICsgJycpO1xuICB9XG4gIGZvciAodmFyIGtleSBpbiBvYmplY3QpIHtcbiAgICBpZiAoIShza2lwSW5kZXhlcyAmJiBpc0luZGV4KGtleSwgbGVuZ3RoKSkgJiZcbiAgICAgICAgIShrZXkgPT0gJ2NvbnN0cnVjdG9yJyAmJiAoaXNQcm90byB8fCAhaGFzT3duUHJvcGVydHkuY2FsbChvYmplY3QsIGtleSkpKSkge1xuICAgICAgcmVzdWx0LnB1c2goa2V5KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBrZXlzSW47XG4iLCIvKipcbiAqIFRoaXMgbWV0aG9kIHJldHVybnMgdGhlIGZpcnN0IGFyZ3VtZW50IHByb3ZpZGVkIHRvIGl0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgVXRpbGl0eVxuICogQHBhcmFtIHsqfSB2YWx1ZSBBbnkgdmFsdWUuXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyBgdmFsdWVgLlxuICogQGV4YW1wbGVcbiAqXG4gKiB2YXIgb2JqZWN0ID0geyAndXNlcic6ICdmcmVkJyB9O1xuICpcbiAqIF8uaWRlbnRpdHkob2JqZWN0KSA9PT0gb2JqZWN0O1xuICogLy8gPT4gdHJ1ZVxuICovXG5mdW5jdGlvbiBpZGVudGl0eSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaWRlbnRpdHk7XG4iLCJ2YXIgYnVuZGxlRm4gPSBhcmd1bWVudHNbM107XG52YXIgc291cmNlcyA9IGFyZ3VtZW50c1s0XTtcbnZhciBjYWNoZSA9IGFyZ3VtZW50c1s1XTtcblxudmFyIHN0cmluZ2lmeSA9IEpTT04uc3RyaW5naWZ5O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChmbikge1xuICAgIHZhciBrZXlzID0gW107XG4gICAgdmFyIHdrZXk7XG4gICAgdmFyIGNhY2hlS2V5cyA9IE9iamVjdC5rZXlzKGNhY2hlKTtcbiAgICBcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGNhY2hlS2V5cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdmFyIGtleSA9IGNhY2hlS2V5c1tpXTtcbiAgICAgICAgaWYgKGNhY2hlW2tleV0uZXhwb3J0cyA9PT0gZm4pIHtcbiAgICAgICAgICAgIHdrZXkgPSBrZXk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBpZiAoIXdrZXkpIHtcbiAgICAgICAgd2tleSA9IE1hdGguZmxvb3IoTWF0aC5wb3coMTYsIDgpICogTWF0aC5yYW5kb20oKSkudG9TdHJpbmcoMTYpO1xuICAgICAgICB2YXIgd2NhY2hlID0ge307XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2FjaGVLZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgdmFyIGtleSA9IGNhY2hlS2V5c1tpXTtcbiAgICAgICAgICAgIHdjYWNoZVtrZXldID0ga2V5O1xuICAgICAgICB9XG4gICAgICAgIHNvdXJjZXNbd2tleV0gPSBbXG4gICAgICAgICAgICBGdW5jdGlvbihbJ3JlcXVpcmUnLCdtb2R1bGUnLCdleHBvcnRzJ10sICcoJyArIGZuICsgJykoc2VsZiknKSxcbiAgICAgICAgICAgIHdjYWNoZVxuICAgICAgICBdO1xuICAgIH1cbiAgICB2YXIgc2tleSA9IE1hdGguZmxvb3IoTWF0aC5wb3coMTYsIDgpICogTWF0aC5yYW5kb20oKSkudG9TdHJpbmcoMTYpO1xuICAgIFxuICAgIHZhciBzY2FjaGUgPSB7fTsgc2NhY2hlW3drZXldID0gd2tleTtcbiAgICBzb3VyY2VzW3NrZXldID0gW1xuICAgICAgICBGdW5jdGlvbihbJ3JlcXVpcmUnXSwncmVxdWlyZSgnICsgc3RyaW5naWZ5KHdrZXkpICsgJykoc2VsZiknKSxcbiAgICAgICAgc2NhY2hlXG4gICAgXTtcbiAgICBcbiAgICB2YXIgc3JjID0gJygnICsgYnVuZGxlRm4gKyAnKSh7J1xuICAgICAgICArIE9iamVjdC5rZXlzKHNvdXJjZXMpLm1hcChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICByZXR1cm4gc3RyaW5naWZ5KGtleSkgKyAnOlsnXG4gICAgICAgICAgICAgICAgKyBzb3VyY2VzW2tleV1bMF1cbiAgICAgICAgICAgICAgICArICcsJyArIHN0cmluZ2lmeShzb3VyY2VzW2tleV1bMV0pICsgJ10nXG4gICAgICAgICAgICA7XG4gICAgICAgIH0pLmpvaW4oJywnKVxuICAgICAgICArICd9LHt9LFsnICsgc3RyaW5naWZ5KHNrZXkpICsgJ10pJ1xuICAgIDtcbiAgICBcbiAgICB2YXIgVVJMID0gd2luZG93LlVSTCB8fCB3aW5kb3cud2Via2l0VVJMIHx8IHdpbmRvdy5tb3pVUkwgfHwgd2luZG93Lm1zVVJMO1xuICAgIFxuICAgIHJldHVybiBuZXcgV29ya2VyKFVSTC5jcmVhdGVPYmplY3RVUkwoXG4gICAgICAgIG5ldyBCbG9iKFtzcmNdLCB7IHR5cGU6ICd0ZXh0L2phdmFzY3JpcHQnIH0pXG4gICAgKSk7XG59O1xuIiwiY29uc29sZS5sb2coXCJDYW52YXMgcGxheWVyIVwiKVxyXG4oKG5zKSAtPlxyXG4gIG5zLkNhbnZhc1BsYXllciA9IHJlcXVpcmUoJy4vcGxheWVyJylcclxuICBucy5DYW52YXNDbGlwID0gcmVxdWlyZSgnLi9jbGlwJylcclxuICBucy5Db2xvclV0aWwgPSByZXF1aXJlKCcuL2NvbG9yJylcclxuICByZXR1cm5cclxuKSh3aW5kb3cpXHJcbiIsImRlZmF1bHRzID0gcmVxdWlyZSgnbG9kYXNoL29iamVjdC9kZWZhdWx0cycpXHJcblBsYXlhYmxlID0gcmVxdWlyZSgnLi9wbGF5YWJsZScpXHJcbmlzTnVtYmVyID0gcmVxdWlyZSgnbG9kYXNoL2xhbmcvaXNOdW1iZXInKVxyXG5pc0Z1bmN0aW9uID0gcmVxdWlyZSgnbG9kYXNoL2xhbmcvaXNGdW5jdGlvbicpXHJcblJ1bm5lciA9IHJlcXVpcmUoJy4vcnVubmVyJylcclxuQ29sb3JVdGlsID0gcmVxdWlyZSgnLi9jb2xvcicpXHJcblxyXG4jIHJ1bm5lciA9IG5ldyBSdW5uZXIoKVxyXG4jIHRhc2sgPSAoYSwgYikgLT5cclxuIyAgIE1hdGguc3FydChhICogYSArIGIgKiBiKVxyXG4jIHRhc2tGbiA9IChmMSwgZjIsIGEpIC0+XHJcbiMgICBmMSBmMiBhXHJcbiMgdGFza0ZucyA9IChmcywgYSkgLT5cclxuIyAgIGZzWzBdIGZzWzFdIGFcclxuIyBydW5uZXIucnVuIHRhc2ssIDMsIDQsIChlcnIsIHIpIC0+XHJcbiMgICBpZiBlcnJcclxuIyAgICAgY29uc29sZS5lcnJvciBlcnJcclxuIyAgIGNvbnNvbGUubG9nIHJcclxuIyBmMSA9IChhKSAtPiBhICsgXCIuMVwiXHJcbiMgZjIgPSAoYSkgLT4gYSArIFwiLjJcIlxyXG4jIHJ1bm5lci5ydW4gdGFza0ZuLCBmMSwgZjIsIFwiZm9vXCIgLCAoZXJyLCByKSAtPlxyXG4jICAgaWYgZXJyXHJcbiMgICAgIGNvbnNvbGUuZXJyb3IgZXJyXHJcbiMgICBjb25zb2xlLmxvZyByXHJcbiMgcnVubmVyLnJ1biB0YXNrRm5zLCBbZjEsIGYyXSwgXCJmb29cIiAsIChlcnIsIHIpIC0+XHJcbiMgICBpZiBlcnJcclxuIyAgICAgY29uc29sZS5lcnJvciBlcnJcclxuIyAgIGNvbnNvbGUubG9nIHJcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9XHJcbmNsYXNzIENhbnZhc0NsaXAgZXh0ZW5kcyBQbGF5YWJsZVxyXG4gIEBEZWZhdWx0T3B0czpcclxuICAgIGZwczogMTVcclxuICAgIHdpZHRoOiA4MDBcclxuICAgIGhlaWdodDogNDUwXHJcbiAgICBtYXhDb25jdXJyZW5jeTogMTBcclxuXHJcbiAgY29uc3RydWN0b3I6IChAc3ByaXRlLCBvcHRzKSAtPlxyXG4gICAgQG9wdHMgPSBkZWZhdWx0cyB7fSwgb3B0cywgQGNvbnN0cnVjdG9yLkRlZmF1bHRPcHRzXHJcbiAgICBjb25zb2xlLmxvZyBAb3B0c1xyXG4gICAgY29uc29sZS5sb2cgQHNwcml0ZVxyXG4gICAgQF9sb2FkZWQgPSBmYWxzZVxyXG4gICAgQF9pbl90ID0gQF9vdXRfdCA9IDBcclxuICAgIEBfZHVyYXRpb24gPSAxMDAwIC8gQG9wdHMuZnBzICogQG9wdHMuZnJhbWVzXHJcbiAgICBAX2FscGhhX3RyYW5zZnJvbXMgPSBbXVxyXG4gICAgQF9maWx0ZXJzID0gW11cclxuICAgIEBfc3RhdHVzID0gXCJpZGxlXCJcclxuXHJcbiAgICBAX2xvYWQoKVxyXG5cclxuICBfbG9hZDogLT5cclxuICAgIEBfb3JpX2ltYWdlID0gbmV3IEltYWdlKClcclxuICAgIEBfb3JpX2ltYWdlLm9ubG9hZCA9IEBfb25Mb2FkXHJcbiAgICBAX29yaV9pbWFnZS5vbmVycm9yID0gQF9vbkVycm9yXHJcbiAgICBAX29yaV9pbWFnZS5zcmMgPSBAc3ByaXRlXHJcblxyXG4gIF9vbkxvYWQ6ID0+XHJcbiAgICAjIEBlbWl0ICdyZWFkeSdcclxuICAgIEBfbG9hZGVkID0gdHJ1ZVxyXG4gICAgQF9zdGF0dXMgPSBcImxvYWRlZFwiXHJcbiAgICBAZW1pdCAnbG9hZGVkJ1xyXG5cclxuICBfb25FcnJvcjogKGUpID0+XHJcbiAgICBAX3N0YXR1cyA9ICdlcnJvcidcclxuICAgIEBlbWl0ICdlcnJvcicsIGVcclxuXHJcbiAgZ2V0U3RhdHVzOiAtPlxyXG4gICAgQF9zdGF0dXNcclxuXHJcbiAgZHVyYXRpb246IC0+XHJcbiAgICBAX2luX3QgKyBAX2R1cmF0aW9uICsgQF9vdXRfdFxyXG5cclxuICBhcHBseTogPT5cclxuICAgIGlmIEBfbG9hZGVkXHJcbiAgICAgIGNvbnNvbGUudGltZShcImFwcGx5XCIpXHJcbiAgICAgIEBfYXBwbHlGYWRlSW4oKVxyXG4gICAgICBAX2FwcGx5RmFkZU91dCgpXHJcbiAgICAgIGNvbnNvbGUudGltZShcImZpbHRlclwiKVxyXG4gICAgICBAX2FwcGx5RmlsdGVyc0luV29ya2VyIChlcnIpID0+XHJcbiAgICAgICMgQF9hcHBseUZpbHRlcnMgKGVycikgPT5cclxuICAgICAgICBjb25zb2xlLnRpbWVFbmQoXCJmaWx0ZXJcIilcclxuICAgICAgICBjb25zb2xlLnRpbWVFbmQoXCJhcHBseVwiKVxyXG4gICAgICAgIGlmIGVyclxyXG4gICAgICAgICAgcmV0dXJuIEBlbWl0ICdlcnJvcicsIGVyclxyXG4gICAgICAgIEBfc3RhdHVzID0gJ3JlYWR5J1xyXG4gICAgICAgIEBlbWl0ICdyZWFkeSdcclxuICAgIGVsc2VcclxuICAgICAgQG9uY2UgJ2xvYWRlZCcsIEBhcHBseVxyXG5cclxuICB3aWxsUGxheTogLT5cclxuICAgIEBhcHBseSgpXHJcblxyXG4gIF9hcHBseUZhZGVJbjogLT5cclxuICAgICMgUHJlcGFyZSBmYWRlIGluXHJcbiAgICBpZiBAX2luX3QgPiAwXHJcbiAgICAgIGluX3RhcmdldF9hbHBoYSA9IEBfYXBwbHlBbHBoYVRyYW5zZm9ybShcImNsaXBcIiwgMClcclxuICAgICAgQGFscGhhIChzdGF0ZSwgcCkgLT5cclxuICAgICAgICBpZiBzdGF0ZSA9PSAnZmFkZV9pbidcclxuICAgICAgICAgIHJldHVybiBwICogaW5fdGFyZ2V0X2FscGhhXHJcbiAgICAgICAgcmV0dXJuIC0xXHJcblxyXG4gIF9hcHBseUZhZGVPdXQ6IC0+XHJcbiAgICAjIFByZXBhcmUgZmFkZSBvdXRcclxuICAgIGlmIEBfb3V0X3QgPiAwXHJcbiAgICAgIG91dF9mcm9tX2FscGhhID0gQF9hcHBseUFscGhhVHJhbnNmb3JtKFwiY2xpcFwiLCAxKVxyXG4gICAgICBAYWxwaGEgKHN0YXRlLCBwKSAtPlxyXG4gICAgICAgIGlmIHN0YXRlID09ICdmYWRlX291dCdcclxuICAgICAgICAgIHJldHVybiAoMSAtIHApICogb3V0X2Zyb21fYWxwaGFcclxuICAgICAgICByZXR1cm4gLTFcclxuXHJcblxyXG4gIF9hcHBseUZpbHRlcnM6IChjYikgLT5cclxuICAgIHt3aWR0aCwgaGVpZ2h0fSA9IEBfb3JpX2ltYWdlXHJcbiAgICBpZiBub3QgQGZpbHRlckNhbnZhcz9cclxuICAgICAgY29uc29sZS50aW1lKFwiaW5pdFwiKVxyXG4gICAgICBAZmlsdGVyQ2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJylcclxuICAgICAgQGZpbHRlckNhbnZhcy53aWR0aCA9IHdpZHRoXHJcbiAgICAgIEBmaWx0ZXJDYW52YXMuaGVpZ2h0ID0gaGVpZ2h0XHJcbiAgICAgIEBmaWx0ZXJDdHggPSBAZmlsdGVyQ2FudmFzLmdldENvbnRleHQoJzJkJylcclxuICAgICAgQF9pbWFnZSA9IG5ldyBJbWFnZSgpXHJcbiAgICAgIGNvbnNvbGUudGltZUVuZChcImluaXRcIilcclxuXHJcbiAgICBjb25zb2xlLnRpbWUoXCJyZWFkXCIpXHJcbiAgICBAZmlsdGVyQ3R4LmRyYXdJbWFnZShAX29yaV9pbWFnZSwgMCwgMClcclxuICAgIEBfaW1hZ2VEYXRhID0gaW1hZ2VEYXRhID0gQGZpbHRlckN0eC5nZXRJbWFnZURhdGEoMCwgMCwgd2lkdGgsIGhlaWdodClcclxuICAgIGNvbnNvbGUudGltZUVuZChcInJlYWRcIilcclxuICAgIGNvbnNvbGUudGltZShcInJ1blwiKVxyXG4gICAgQF9maWx0ZXJzLmZvckVhY2ggKGZpbHRlcikgLT4gZmlsdGVyLmYoaW1hZ2VEYXRhLCBDb2xvclV0aWwsIGZpbHRlci5hcmdzLi4uKVxyXG4gICAgQGZpbHRlckN0eC5wdXRJbWFnZURhdGEoaW1hZ2VEYXRhLCAwLCAwKVxyXG4gICAgY29uc29sZS50aW1lRW5kKFwicnVuXCIpXHJcbiAgICBjYigpXHJcblxyXG4gIF9hcHBseUZpbHRlcnNJbldvcmtlcjogKGNhbGxiYWNrKSAtPlxyXG4gICAge3dpZHRoLCBoZWlnaHR9ID0gQF9vcmlfaW1hZ2VcclxuICAgIGlmIG5vdCBAZmlsdGVyQ2FudmFzP1xyXG4gICAgICBAZmlsdGVyQ2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJylcclxuICAgICAgQGZpbHRlckNhbnZhcy53aWR0aCA9IHdpZHRoXHJcbiAgICAgIEBmaWx0ZXJDYW52YXMuaGVpZ2h0ID0gaGVpZ2h0XHJcbiAgICAgIEBmaWx0ZXJDdHggPSBAZmlsdGVyQ2FudmFzLmdldENvbnRleHQoJzJkJylcclxuICAgICAgQF9pbWFnZSA9IG5ldyBJbWFnZSgpXHJcblxyXG4gICAgQGZpbHRlckN0eC5kcmF3SW1hZ2UoQF9vcmlfaW1hZ2UsIDAsIDApXHJcbiAgICBpbWFnZURhdGEgPSBAZmlsdGVyQ3R4LmdldEltYWdlRGF0YSgwLCAwLCB3aWR0aCwgaGVpZ2h0KVxyXG4gICAgZG9uZSA9IChlcnIsIGRhdGEpID0+XHJcbiAgICAgIGlmIGVyclxyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IgZXJyXHJcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycilcclxuICAgICAgaWYgZGF0YVxyXG4gICAgICAgIEBmaWx0ZXJDdHgucHV0SW1hZ2VEYXRhKGRhdGEsIDAsIDApXHJcbiAgICAgIGNhbGxiYWNrKClcclxuXHJcbiAgICBpZiBAX2ZpbHRlcnMubGVuZ3RoID4gMFxyXG4gICAgICAjIFNwbGl0IGNhbnZhc1xyXG4gICAgICBuID0gQG9wdHMubWF4Q29uY3VycmVuY3lcclxuICAgICAgc2VncyA9IFtdXHJcbiAgICAgIGlmIG5vdCBAX3J1bm5lcnNcclxuICAgICAgICBAX3J1bm5lcnMgPSBbMC4ubi0xXS5tYXAgLT4gbmV3IFJ1bm5lcigpXHJcbiAgICAgIHJ1bm5lcnMgPSBAX3J1bm5lcnNcclxuICAgICAgc3RlcCA9IGhlaWdodCAvIG5cclxuICAgICAgY29uc29sZS50aW1lKFwiU3BsaXRcIilcclxuICAgICAgZm9yIGkgaW4gWzAuLm4gLSAxXVxyXG4gICAgICAgIHMgPSBAZmlsdGVyQ3R4LmdldEltYWdlRGF0YSAwLCBzdGVwICogaSwgd2lkdGgsIHN0ZXBcclxuICAgICAgICBzZWdzLnB1c2ggc1xyXG4gICAgICBjb25zb2xlLnRpbWVFbmQoXCJTcGxpdFwiKVxyXG5cclxuICAgICAgZG9uZUNvdW50ID0gMFxyXG4gICAgICBwcm9jZXNzZWQgPSBbXVxyXG4gICAgICBlcnJvcnMgPSBbXVxyXG4gICAgICBtZXJnZSA9ID0+XHJcbiAgICAgICAgaWYgZXJyb3JzLmxlbmd0aCA+IDBcclxuICAgICAgICAgIHJldHVybiBkb25lKGVycm9ycylcclxuICAgICAgICBjb25zb2xlLnRpbWUoXCJtZXJnZVwiKVxyXG4gICAgICAgIGZvciBpIGluIFswLi5uIC0gMV1cclxuICAgICAgICAgIHMgPSBAZmlsdGVyQ3R4LnB1dEltYWdlRGF0YSBwcm9jZXNzZWRbaV0sIDAsIHN0ZXAgKiBpXHJcbiAgICAgICAgY29uc29sZS50aW1lRW5kKFwibWVyZ2VcIilcclxuICAgICAgICBkb25lKClcclxuXHJcbiAgICAgIGNvbnNvbGUudGltZShcInJ1blwiKVxyXG4gICAgICBydW5uZXJzLmZvckVhY2ggKHJ1bm5lciwgaSkgPT5cclxuICAgICAgICBydW5uZXIucnVuICgoZmlsdGVycywgYXJncywgZGF0YSwgQ29sb3JVdGlsKSAtPlxyXG4gICAgICAgICAgZmlsdGVycy5mb3JFYWNoIChmLCBpKSAtPlxyXG4gICAgICAgICAgICBmLmFwcGx5KHVuZGVmaW5lZCwgW2RhdGEsIENvbG9yVXRpbF0uY29uY2F0KGFyZ3NbaV0pKVxyXG4gICAgICAgICAgcmV0dXJuIGRhdGFcclxuICAgICAgICAgICksIEBfZmlsdGVycy5tYXAoKGYpIC0+IGYuZiksIEBfZmlsdGVycy5tYXAoKGYpIC0+IGYuYXJncyksXHJcbiAgICAgICAgICBzZWdzW2ldLCAoZXJyLCBwYXJ0KSAtPlxyXG4gICAgICAgICAgICBkb25lQ291bnQrK1xyXG4gICAgICAgICAgICBpZiBlcnJcclxuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yIFwiI3tpfTpcIlxyXG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IgZXJyXHJcbiAgICAgICAgICAgICAgZXJyb3JzLnB1c2goZXJyKVxyXG4gICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgcHJvY2Vzc2VkW2ldID0gcGFydFxyXG4gICAgICAgICAgICBpZiBkb25lQ291bnQgPT0gblxyXG4gICAgICAgICAgICAgIGNvbnNvbGUudGltZUVuZCgncnVuJylcclxuICAgICAgICAgICAgICBtZXJnZSgpXHJcbiAgICBlbHNlXHJcbiAgICAgIGRvbmUoKVxyXG5cclxuXHJcbiAgcmVuZGVyOiAoY3R4LCBkdCkgLT5cclxuICAgIHt3aWR0aCwgaGVpZ2h0LCBjb2xzLCBmcHMsIGZyYW1lc30gPSBAb3B0c1xyXG4gICAgZHRfYWJzID0gZHQgLSBAX2luX3RcclxuICAgIHN0YXRlID0gXCJjbGlwXCJcclxuICAgIGlmIGR0X2FicyA8IDBcclxuICAgICAgc3RhdGUgPSBcImZhZGVfaW5cIlxyXG4gICAgICBkdF9hYnMgPSAwXHJcbiAgICAgIHAgPSBmYWRlX2luX3AgPSBkdCAvIEBfaW5fdFxyXG4gICAgICBmID0gMFxyXG4gICAgZWxzZSBpZiBkdF9hYnMgPiBAX2R1cmF0aW9uXHJcbiAgICAgIHN0YXRlID0gXCJmYWRlX291dFwiXHJcbiAgICAgIHAgPSBmYWRlX291dF9wID0gKGR0X2FicyAtIEBfZHVyYXRpb24pIC8gQF9vdXRfdFxyXG4gICAgICBkdF9hYnMgPSBAX2R1cmF0aW9uXHJcbiAgICAgIGYgPSBmcmFtZXMgLSAxXHJcbiAgICBlbHNlXHJcbiAgICAgIHN0YXRlID0gXCJjbGlwXCJcclxuICAgICAgZiA9IGR0X2FicyAvICgxMDAwIC8gZnBzKVxyXG4gICAgICBwID0gKGR0IC0gQF9pbl90KSAvIEBfZHVyYXRpb25cclxuXHJcbiAgICB4ID0gfn4oZiAlIGNvbHMpICogd2lkdGhcclxuICAgIHkgPSB+fihmIC8gY29scykgKiBoZWlnaHRcclxuXHJcbiAgICBjdHguZ2xvYmFsQWxwaGEgPSBAX2FwcGx5QWxwaGFUcmFuc2Zvcm0oc3RhdGUsIHApXHJcbiAgICBjdHguZHJhd0ltYWdlKEBmaWx0ZXJDYW52YXMsIHgsIHksIHdpZHRoLCBoZWlnaHQsXHJcbiAgICAgIEBfYXBwbHlUcmFuc2Zvcm0oXCJ4XCIsIHN0YXRlLCBwKSxcclxuICAgICAgQF9hcHBseVRyYW5zZm9ybShcInlcIiwgc3RhdGUsIHApLFxyXG4gICAgICB3aWR0aCwgaGVpZ2h0KVxyXG5cclxuICByZW5kZXJGcmFtZTogKGN0eCwgZikgLT5cclxuICAgIHt3aWR0aCwgaGVpZ2h0LCBjb2xzLCBmcHMsIGZyYW1lc30gPSBAb3B0c1xyXG5cclxuICAgIHggPSB+fihmICUgY29scykgKiB3aWR0aFxyXG4gICAgeSA9IH5+KGYgLyBjb2xzKSAqIGhlaWdodFxyXG5cclxuICAgIHAgPSBmIC8gZnJhbWVzXHJcblxyXG4gICAgY3R4Lmdsb2JhbEFscGhhID0gQF9hcHBseUFscGhhVHJhbnNmb3JtKCdjbGlwJywgcClcclxuICAgIGN0eC5kcmF3SW1hZ2UoQGZpbHRlckNhbnZhcywgeCwgeSwgd2lkdGgsIGhlaWdodCxcclxuICAgICAgQF9hcHBseVRyYW5zZm9ybShcInhcIiwgJ2NsaXAnLCBwKSxcclxuICAgICAgQF9hcHBseVRyYW5zZm9ybShcInlcIiwgJ2NsaXAnLCBwKSxcclxuICAgICAgd2lkdGgsIGhlaWdodClcclxuXHJcbiAgX2FwcGx5QWxwaGFUcmFuc2Zvcm06IChzdGF0ZSwgcCkgLT5cclxuICAgIGlmIEBfYWxwaGFfdHJhbnNmcm9tcy5sZW5ndGggPT0gMFxyXG4gICAgICByZXR1cm4gMVxyXG5cclxuICAgIGFwcGx5QWxwaGEgPSAoZikgLT5cclxuICAgICAgaWYgaXNOdW1iZXIgZlxyXG4gICAgICAgIHJldHVybiBmXHJcbiAgICAgIGlmIGlzRnVuY3Rpb24gZlxyXG4gICAgICAgIHJldHVybiBmKHN0YXRlLCBwKVxyXG5cclxuICAgIGZpbmFsID0gMVxyXG4gICAgQF9hbHBoYV90cmFuc2Zyb21zLmZvckVhY2ggKGYpIC0+XHJcbiAgICAgIGEgPSBhcHBseUFscGhhKGYpXHJcbiAgICAgIGlmIGEgPj0gMFxyXG4gICAgICAgIGZpbmFsID0gYVxyXG5cclxuICAgIHJldHVybiBmaW5hbFxyXG5cclxuICBfYXBwbHlUcmFuc2Zvcm06ICh0LCBzdGF0ZSwgcCkgLT5cclxuICAgIHRyYW5zID0gQFtcInQje3R9XCJdXHJcbiAgICBpZiBub3QgdHJhbnM/XHJcbiAgICAgIHJldHVybiAwXHJcbiAgICBpZiBpc051bWJlciB0cmFuc1xyXG4gICAgICByZXR1cm4gdHJhbnNcclxuICAgIHJldHVybiB0cmFucyhzdGF0ZSwgcClcclxuXHJcbiAgZmFkZUluOiAodCkgLT5cclxuICAgIEBfaW5fdCA9IHRcclxuICAgIEBcclxuXHJcbiAgZmFkZU91dDogKHQpIC0+XHJcbiAgICBAX291dF90ID0gdFxyXG4gICAgQFxyXG5cclxuICBhZGRGaWx0ZXI6IChmLCBhcmdzLi4uKSAtPlxyXG4gICAgaWYgaXNGdW5jdGlvbihmKVxyXG4gICAgICBAX3N0YXR1cyA9IGlmIEBfc3RhdHVzID09ICdyZWFkeScgdGhlbiAnbG9hZGVkJyBlbHNlICdpZGxlJ1xyXG4gICAgICBAX2ZpbHRlcnMucHVzaCh7ZjogZiwgYXJnczogYXJncyA/IFtdfSlcclxuICAgIEBcclxuXHJcbiAgcmVtb3ZlRmlsdGVyOiAoZikgLT5cclxuICAgIGlmIGlzRnVuY3Rpb24oZilcclxuICAgICAgaSA9IEBfZmlsdGVycy5maW5kSW5kZXggKGZpbHRlcikgLT4gZmlsdGVyLmYgPT0gZlxyXG4gICAgICBpZiBpID49IDBcclxuICAgICAgICBAX3N0YXR1cyA9IGlmIEBfc3RhdHVzID09ICdyZWFkeScgdGhlbiAnbG9hZGVkJyBlbHNlICdpZGxlJ1xyXG4gICAgICAgIEBfZmlsdGVycy5zcGxpY2UoaSwgMSlcclxuICAgIEBcclxuXHJcbiAgdXBkYXRlRmlsdGVyOiAoZiwgYXJncy4uLikgLT5cclxuICAgIGlmIGlzRnVuY3Rpb24oZilcclxuICAgICAgZmlsdGVyID0gQF9maWx0ZXJzLmZpbmQgKGZpbHRlcikgLT4gZmlsdGVyLmYgPT0gZlxyXG4gICAgICBAX3N0YXR1cyA9IGlmIEBfc3RhdHVzID09ICdyZWFkeScgdGhlbiAnbG9hZGVkJyBlbHNlICdpZGxlJ1xyXG4gICAgICBmaWx0ZXI/LmFyZ3MgPSBhcmdzXHJcbiAgICBAXHJcblxyXG4gIGNsZWFyRmlsdGVyczogLT5cclxuICAgIEBfZmlsdGVycyA9IFtdXHJcbiAgICBAX3N0YXR1cyA9IGlmIEBfc3RhdHVzID09ICdyZWFkeScgdGhlbiAnbG9hZGVkJyBlbHNlICdpZGxlJ1xyXG4gICAgQFxyXG5cclxuICB4OiAodHgpIC0+XHJcbiAgICBpZiBpc051bWJlcih0eCkgb3IgaXNGdW5jdGlvbih0eClcclxuICAgICAgQHR4ID0gdHhcclxuICAgIEBcclxuXHJcbiAgeTogKHR5KSAtPlxyXG4gICAgaWYgaXNOdW1iZXIodHkpIG9yIGlzRnVuY3Rpb24odHkpXHJcbiAgICAgIEB0eSA9IHR5XHJcbiAgICBAXHJcblxyXG4gIHNjYWxlOiAoQHRzKSAtPlxyXG4gICAgQFxyXG5cclxuICBhbHBoYTogKHRhKSAtPlxyXG4gICAgaWYgaXNOdW1iZXIodGEpIG9yIGlzRnVuY3Rpb24odGEpXHJcbiAgICAgIEBfYWxwaGFfdHJhbnNmcm9tcy5wdXNoKHRhKVxyXG4gICAgQFxyXG4iLCJtb2R1bGUuZXhwb3J0cyA9XHJcbiAgcmdiVG9Ic2w6IChyLCBnLCBiKSAtPlxyXG4gICAgciAvPSAyNTVcclxuICAgIGcgLz0gMjU1XHJcbiAgICBiIC89IDI1NVxyXG4gICAgbWF4ID0gTWF0aC5tYXgociwgZywgYilcclxuICAgIG1pbiA9IE1hdGgubWluKHIsIGcsIGIpXHJcbiAgICBoID0gdW5kZWZpbmVkXHJcbiAgICBzID0gdW5kZWZpbmVkXHJcbiAgICBsID0gKG1heCArIG1pbikgLyAyXHJcbiAgICBpZiBtYXggPT0gbWluXHJcbiAgICAgIGggPSBzID0gMFxyXG4gICAgICAjIGFjaHJvbWF0aWNcclxuICAgIGVsc2VcclxuICAgICAgZCA9IG1heCAtIG1pblxyXG4gICAgICBzID0gaWYgbCA+IDAuNSB0aGVuIGQgLyAoMiAtIG1heCAtIG1pbikgZWxzZSBkIC8gKG1heCArIG1pbilcclxuICAgICAgc3dpdGNoIG1heFxyXG4gICAgICAgIHdoZW4gclxyXG4gICAgICAgICAgaCA9IChnIC0gYikgLyBkICsgKGlmIGcgPCBiIHRoZW4gNiBlbHNlIDApXHJcbiAgICAgICAgd2hlbiBnXHJcbiAgICAgICAgICBoID0gKGIgLSByKSAvIGQgKyAyXHJcbiAgICAgICAgd2hlbiBiXHJcbiAgICAgICAgICBoID0gKHIgLSBnKSAvIGQgKyA0XHJcbiAgICAgIGggLz0gNlxyXG4gICAgW2gsIHMsIGxdXHJcblxyXG4gIGhzbFRvUmdiOiAoaCwgcywgbCkgLT5cclxuICAgIHIgPSB1bmRlZmluZWRcclxuICAgIGcgPSB1bmRlZmluZWRcclxuICAgIGIgPSB1bmRlZmluZWRcclxuXHJcbiAgICBodWUycmdiID0gKHAsIHEsIHQpIC0+XHJcbiAgICAgIGlmIHQgPCAwXHJcbiAgICAgICAgdCArPSAxXHJcbiAgICAgIGlmIHQgPiAxXHJcbiAgICAgICAgdCAtPSAxXHJcbiAgICAgIGlmIHQgPCAxIC8gNlxyXG4gICAgICAgIHJldHVybiBwICsgKHEgLSBwKSAqIDYgKiB0XHJcbiAgICAgIGlmIHQgPCAxIC8gMlxyXG4gICAgICAgIHJldHVybiBxXHJcbiAgICAgIGlmIHQgPCAyIC8gM1xyXG4gICAgICAgIHJldHVybiBwICsgKHEgLSBwKSAqICgyIC8gMyAtIHQpICogNlxyXG4gICAgICBwXHJcblxyXG4gICAgaWYgcyA9PSAwXHJcbiAgICAgIHIgPSBnID0gYiA9IGxcclxuICAgICAgIyBhY2hyb21hdGljXHJcbiAgICBlbHNlXHJcbiAgICAgIHEgPSBpZiBsIDwgMC41IHRoZW4gbCAqICgxICsgcykgZWxzZSBsICsgcyAtIChsICogcylcclxuICAgICAgcCA9IDIgKiBsIC0gcVxyXG4gICAgICByID0gaHVlMnJnYihwLCBxLCBoICsgMSAvIDMpXHJcbiAgICAgIGcgPSBodWUycmdiKHAsIHEsIGgpXHJcbiAgICAgIGIgPSBodWUycmdiKHAsIHEsIGggLSAoMSAvIDMpKVxyXG4gICAgW1xyXG4gICAgICByICogMjU1XHJcbiAgICAgIGcgKiAyNTVcclxuICAgICAgYiAqIDI1NVxyXG4gICAgXVxyXG4iLCJ7RXZlbnRFbWl0dGVyfSA9IHJlcXVpcmUoJ2V2ZW50cycpXHJcbm1vZHVsZS5leHBvcnRzID1cclxuY2xhc3MgUGxheWFibGUgZXh0ZW5kcyBFdmVudEVtaXR0ZXJcclxuICB3aWxsUGxheTogLT5cclxuXHJcbiAgcmVuZGVyOiAoY3R4LCBkdCkgLT5cclxuICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKVxyXG5cclxuICBkdXJhdGlvbjogLT5cclxuICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKVxyXG5cclxuICBnZXRTdGF0dXM6IC0+XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIilcclxuIiwie0V2ZW50RW1pdHRlcn0gPSByZXF1aXJlKCdldmVudHMnKVxyXG5kZWZhdWx0cyA9IHJlcXVpcmUoJ2xvZGFzaC9vYmplY3QvZGVmYXVsdHMnKVxyXG5pc1N0cmluZyA9IHJlcXVpcmUoJ2xvZGFzaC9sYW5nL2lzU3RyaW5nJylcclxubW9kdWxlLmV4cG9ydHMgPVxyXG5jbGFzcyBDYW52YXNQbGF5ZXIgZXh0ZW5kcyBFdmVudEVtaXR0ZXJcclxuICBARGVmYXVsdE9wdHM6XHJcbiAgICB3aWR0aDogODAwXHJcbiAgICBoZWlnaHQ6IDQ1MFxyXG4gIGNvbnN0cnVjdG9yOiAoZWwsIG9wdHMpIC0+XHJcbiAgICBAb3B0cyA9IGRlZmF1bHRzIHt9LCBvcHRzLCBAY29uc3RydWN0b3IuRGVmYXVsdE9wdHNcclxuICAgIEBlbCA9IGlmIGlzU3RyaW5nIGVsIHRoZW4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihlbCkgZWxzZSBlbFxyXG4gICAgQF9zdG9wcGluZyA9IGZhbHNlXHJcbiAgICBAX2luaXRDYW52YXMoKVxyXG5cclxuICBfaW5pdENhbnZhczogLT5cclxuICAgICMgaW5pdGlhbGl6ZSBjYW52YXNcclxuICAgIEBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKVxyXG4gICAgQGNhbnZhcy53aWR0aCA9IEBvcHRzLndpZHRoXHJcbiAgICBAY2FudmFzLmhlaWdodCA9IEBvcHRzLmhlaWdodFxyXG4gICAgIyBpbml0aWFsaXplIGNvbnRleHRcclxuICAgIEBjdHggPSBAY2FudmFzLmdldENvbnRleHQoJzJkJylcclxuXHJcbiAgICBAZWwuYXBwZW5kQ2hpbGQoQGNhbnZhcylcclxuXHJcbiAgcGxheTogKHBsYXlhYmxlKSA9PlxyXG4gICAgaWYgcGxheWFibGUuZ2V0U3RhdHVzKCkgIT0gJ3JlYWR5J1xyXG4gICAgICBjb25zb2xlLmxvZyBcIndhaXRpbmc6ICN7cGxheWFibGUuZ2V0U3RhdHVzKCl9XCJcclxuICAgICAgcGxheWFibGUub25jZSAncmVhZHknLCBAcGxheS5iaW5kKEAsIHBsYXlhYmxlKVxyXG4gICAgZWxzZVxyXG4gICAgICAjIEBwbGF5YWJsZS53aWxsUGxheSgpXHJcbiAgICAgICMgVE9ETzogY2hlY2sgcGxheWFibGUgc3RhdHVzIGJlZm9yZSBhY3R1YWxseSBwbGF5aW5nXHJcbiAgICAgIEBfdDAgPSAtMVxyXG4gICAgICBAcGxheWFibGUgPSBwbGF5YWJsZVxyXG4gICAgICBjb25zb2xlLmxvZyBcIlBsYXlcIlxyXG4gICAgICBAZW1pdCBcInBsYXlcIlxyXG4gICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgQF90aWNrXHJcblxyXG4gICAgQFxyXG5cclxuICBzdG9wOiAtPlxyXG4gICAgQF9zdG9wcGluZyA9IHRydWVcclxuXHJcbiAgc2VlazogKHBsYXlhYmxlLCBmKSAtPlxyXG4gICAgcGxheWFibGUucmVuZGVyRnJhbWUoQGN0eCwgZilcclxuXHJcbiAgcGF1c2U6IC0+XHJcbiAgICBAZW1pdCBcInBhdXNlXCJcclxuXHJcbiAgcmVzdW1lOiAtPlxyXG4gICAgQGVtaXQgXCJyZXN1bWVcIlxyXG5cclxuICBfdGljazogKHQpID0+XHJcbiAgICBpZiBAX3QwIDwgMFxyXG4gICAgICBAX3QwID0gdFxyXG5cclxuICAgIGR0ID0gKHQgLSBAX3QwKSAlIEBwbGF5YWJsZS5kdXJhdGlvbigpXHJcbiAgICBjb25zb2xlLmxvZyhkdClcclxuICAgICMgZiA9IGR0IC8gKDEwMDAgLyA2MClcclxuICAgIEBjdHguY2xlYXJSZWN0KDAsIDAsIEBvcHRzLndpZHRoLCBAb3B0cy5oZWlnaHQpXHJcbiAgICBAcGxheWFibGUucmVuZGVyKEBjdHgsIGR0KVxyXG4gICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lIEBfdGlja1xyXG4gICAgIyBpZiBub3QgQF9zdG9wcGluZ1xyXG4gICAgIyAgIHJlcXVlc3RBbmltYXRpb25GcmFtZSBAX3RpY2tcclxuICAgICMgZWxzZVxyXG4gICAgIyAgIEBlbWl0IFwic3RvcFwiXHJcbiAgICAjICAgQF9zdG9wcGluZyA9IHRydWVcclxuXHJcbiAgICBpZiBAX3QwICE9IHQgYW5kIGR0IDwgMTAwMCAvIDYwXHJcbiAgICAgIEBlbWl0IFwiY29tcGxldGVcIlxyXG4iLCJpc0Z1bmN0aW9uID0gcmVxdWlyZSgnbG9kYXNoL2xhbmcvaXNGdW5jdGlvbicpXHJcbmlzQXJyYXkgPSByZXF1aXJlKCdsb2Rhc2gvbGFuZy9pc0FycmF5JylcclxuV29yayA9IHJlcXVpcmUoJ3dlYndvcmtpZnknKVxyXG5cclxuZm5SZWdleCA9IC9mdW5jdGlvblxccyouKlxccypcXCgoLiopXFwpXFxzKlxceyhbXFxzXFxTXSopXFx9L1xyXG5cclxuVEFTS19DT1VOVCA9IDBcclxuXHJcbm1vZHVsZS5leHBvcnRzID1cclxuY2xhc3MgUnVubmVyXHJcbiAgY29uc3RydWN0b3I6IC0+XHJcbiAgICBAd29ya2VyID0gbmV3IFdvcmsocmVxdWlyZSgnLi93b3JrZXInKSlcclxuICAgIEB3b3JrZXIuYWRkRXZlbnRMaXN0ZW5lciAnbWVzc2FnZScsIEBvbk1lc3NhZ2VcclxuICAgIEBfY2FsbGJhY2tzID0ge31cclxuXHJcbiAgb25NZXNzYWdlOiAoZSkgPT5cclxuICAgIHJldCA9IGUuZGF0YVxyXG4gICAgaWQgPSByZXQuaWRcclxuICAgIGNiID0gQF9jYWxsYmFja3NbaWRdXHJcbiAgICBkZWxldGUgQF9jYWxsYmFja3NbaWRdXHJcbiAgICBjYj8gcmV0LmVyciwgcmV0LnJlc3VsdFxyXG5cclxuICBwYWNrRm46IChmbikgLT5cclxuICAgIGlmIG5vdCBpc0Z1bmN0aW9uIGZuXHJcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCInZm4nIGlzIG5vdCBhIGZ1bmN0aW9uXCIpXHJcbiAgICBtID0gZm4udG9TdHJpbmcoKS5tYXRjaCBmblJlZ2V4XHJcbiAgICBhcmdzID0gbVsxXS5zcGxpdChcIixcIikubWFwIChzKSAtPiBzLnRyaW0oKVxyXG4gICAgYm9keSA9IG1bMl1cclxuICAgIGYgPVxyXG4gICAgICBhcmdzOiBhcmdzXHJcbiAgICAgIGJvZHk6IGJvZHlcclxuICAgIGZcclxuXHJcbiAgcGFja0ZuSW5BcnJheTogKGFycikgLT5cclxuICAgIGZvciBhLCBpIGluIGFyclxyXG4gICAgICBpZiBpc0Z1bmN0aW9uIGFcclxuICAgICAgICBhcnJbaV0gPSBAcGFja0ZuIGFcclxuICAgICAgZWxzZSBpZiBpc0FycmF5IGFcclxuICAgICAgICBhcnJbaV0gPSBAcGFja0ZuSW5BcnJheSBhXHJcbiAgICBhcnJcclxuXHJcbiAgcnVuOiAoZm4sIGFyZ3MuLi4sIGNiKSAtPlxyXG4gICAgcGF5bG9hZCA9XHJcbiAgICAgIGlkOiBUQVNLX0NPVU5UKytcclxuICAgICAgZm46IEBwYWNrRm4oZm4pXHJcbiAgICAgIGFyZ3M6IEBwYWNrRm5JbkFycmF5KGFyZ3MpXHJcbiAgICBAd29ya2VyLnBvc3RNZXNzYWdlKHBheWxvYWQpXHJcbiAgICBAX2NhbGxiYWNrc1twYXlsb2FkLmlkXSA9IGNiXHJcbiIsImlzT2JqZWN0ID0gcmVxdWlyZSgnbG9kYXNoL2xhbmcvaXNPYmplY3QnKVxyXG5pc0FycmF5ID0gcmVxdWlyZSgnbG9kYXNoL2xhbmcvaXNBcnJheScpXHJcbmlzU3RyaW5nID0gcmVxdWlyZSgnbG9kYXNoL2xhbmcvaXNTdHJpbmcnKVxyXG5Db2xvclV0aWwgPSByZXF1aXJlKCcuL2NvbG9yJylcclxuXHJcbmlzUGFja2VkRnVuY3Rpb24gPSAoZikgLT5cclxuICBpc09iamVjdChmKSBhbmQgaXNBcnJheShmLmFyZ3MpIGFuZCBpc1N0cmluZyhmLmJvZHkpXHJcblxyXG5idWlsZEZuID0gKHthcmdzLCBib2R5fSkgLT5cclxuICBhcmdzID0gYXJncy5jb25jYXQoYm9keSlcclxuICBhcmdzLnVuc2hpZnQobnVsbClcclxuICBuZXcgKEZ1bmN0aW9uOjpiaW5kLmFwcGx5KEZ1bmN0aW9uLCBhcmdzKSlcclxuXHJcbmJ1aWxkRm5JbkFycmF5ID0gKGFycikgLT5cclxuICBmb3IgYSwgaSBpbiBhcnJcclxuICAgIGlmIGlzUGFja2VkRnVuY3Rpb24gYVxyXG4gICAgICBhcnJbaV0gPSBidWlsZEZuIGFcclxuICAgIGVsc2UgaWYgaXNBcnJheSBhXHJcbiAgICAgIGFycltpXSA9IGJ1aWxkRm5JbkFycmF5IGFcclxuICBhcnJcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gKHNlbGYpIC0+XHJcbiAgc2VsZi5hZGRFdmVudExpc3RlbmVyICdtZXNzYWdlJywgKGUpIC0+XHJcbiAgICBwYXlsb2FkID0gZS5kYXRhXHJcbiAgICBmbiA9IGJ1aWxkRm4ocGF5bG9hZC5mbilcclxuICAgIGFyZ3MgPSBidWlsZEZuSW5BcnJheShwYXlsb2FkLmFyZ3MpXHJcbiAgICBhcmdzLnB1c2goQ29sb3JVdGlsKVxyXG4gICAgdHJ5XHJcbiAgICAgIHIgPSBmbi5hcHBseSBudWxsLCBhcmdzXHJcbiAgICBjYXRjaCBlcnJvclxyXG4gICAgICBlcnIgPVxyXG4gICAgICAgIG5hbWU6IGVycm9yLm5hbWVcclxuICAgICAgICBtZXNzYWdlOiBlcnJvci5tZXNzYWdlXHJcbiAgICAgICAgc3RhY2s6IGVycm9yLnN0YWNrXHJcblxyXG4gICAgcmV0ID1cclxuICAgICAgaWQ6IHBheWxvYWQuaWRcclxuICAgICAgcmVzdWx0OiByXHJcbiAgICAgIGVycjogZXJyXHJcbiAgICBzZWxmLnBvc3RNZXNzYWdlIHJldFxyXG4iXX0=
