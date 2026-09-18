/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import $protobuf from "protobufjs/minimal.js";

// Common aliases
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const arcade = $root.arcade = (() => {

    /**
     * Namespace arcade.
     * @exports arcade
     * @namespace
     */
    const arcade = {};

    arcade.dungeon = (function() {

        /**
         * Namespace dungeon.
         * @memberof arcade
         * @namespace
         */
        const dungeon = {};

        dungeon.DungeonRequest = (function() {

            /**
             * Properties of a DungeonRequest.
             * @memberof arcade.dungeon
             * @interface IDungeonRequest
             * @property {string|null} [id] DungeonRequest id
             * @property {string|null} [action] DungeonRequest action
             * @property {Uint8Array|null} [params] DungeonRequest params
             */

            /**
             * Constructs a new DungeonRequest.
             * @memberof arcade.dungeon
             * @classdesc Represents a DungeonRequest.
             * @implements IDungeonRequest
             * @constructor
             * @param {arcade.dungeon.IDungeonRequest=} [properties] Properties to set
             */
            function DungeonRequest(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * DungeonRequest id.
             * @member {string} id
             * @memberof arcade.dungeon.DungeonRequest
             * @instance
             */
            DungeonRequest.prototype.id = "";

            /**
             * DungeonRequest action.
             * @member {string} action
             * @memberof arcade.dungeon.DungeonRequest
             * @instance
             */
            DungeonRequest.prototype.action = "";

            /**
             * DungeonRequest params.
             * @member {Uint8Array} params
             * @memberof arcade.dungeon.DungeonRequest
             * @instance
             */
            DungeonRequest.prototype.params = $util.newBuffer([]);

            /**
             * Creates a new DungeonRequest instance using the specified properties.
             * @function create
             * @memberof arcade.dungeon.DungeonRequest
             * @static
             * @param {arcade.dungeon.IDungeonRequest=} [properties] Properties to set
             * @returns {arcade.dungeon.DungeonRequest} DungeonRequest instance
             */
            DungeonRequest.create = function create(properties) {
                return new DungeonRequest(properties);
            };

            /**
             * Encodes the specified DungeonRequest message. Does not implicitly {@link arcade.dungeon.DungeonRequest.verify|verify} messages.
             * @function encode
             * @memberof arcade.dungeon.DungeonRequest
             * @static
             * @param {arcade.dungeon.IDungeonRequest} message DungeonRequest message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonRequest.encode = function encode(message, writer, q) {
                if (!writer)
                    writer = $Writer.create();
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
                if (message.action != null && Object.hasOwnProperty.call(message, "action"))
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.action);
                if (message.params != null && Object.hasOwnProperty.call(message, "params"))
                    writer.uint32(/* id 3, wireType 2 =*/26).bytes(message.params);
                return writer;
            };

            /**
             * Encodes the specified DungeonRequest message, length delimited. Does not implicitly {@link arcade.dungeon.DungeonRequest.verify|verify} messages.
             * @function encodeDelimited
             * @memberof arcade.dungeon.DungeonRequest
             * @static
             * @param {arcade.dungeon.IDungeonRequest} message DungeonRequest message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonRequest.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
            };

            /**
             * Decodes a DungeonRequest message from the specified reader or buffer.
             * @function decode
             * @memberof arcade.dungeon.DungeonRequest
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {arcade.dungeon.DungeonRequest} DungeonRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonRequest.decode = function decode(reader, length, error, long) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (long === undefined)
                    long = 0;
                if (long > $Reader.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let end, message;
                if (length === undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = new $root.arcade.dungeon.DungeonRequest();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.id = reader.string();
                            break;
                        }
                    case 2: {
                            message.action = reader.string();
                            break;
                        }
                    case 3: {
                            message.params = reader.bytes();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7, long);
                        break;
                    }
                }
                if (length !== undefined) {
                    if (reader.pos !== end)
                        throw RangeError("index out of range");
                    reader.len = length;
                }
                return message;
            };

            /**
             * Decodes a DungeonRequest message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof arcade.dungeon.DungeonRequest
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {arcade.dungeon.DungeonRequest} DungeonRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonRequest.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a DungeonRequest message.
             * @function verify
             * @memberof arcade.dungeon.DungeonRequest
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            DungeonRequest.verify = function verify(message, long) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    return "maximum nesting depth exceeded";
                if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                    if (!$util.isString(message.id))
                        return "id: string expected";
                if (message.action != null && Object.hasOwnProperty.call(message, "action"))
                    if (!$util.isString(message.action))
                        return "action: string expected";
                if (message.params != null && Object.hasOwnProperty.call(message, "params"))
                    if (!(message.params && typeof message.params.length === "number" || $util.isString(message.params)))
                        return "params: buffer expected";
                return null;
            };

            /**
             * Creates a DungeonRequest message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof arcade.dungeon.DungeonRequest
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {arcade.dungeon.DungeonRequest} DungeonRequest
             */
            DungeonRequest.fromObject = function fromObject(object, long) {
                if (object instanceof $root.arcade.dungeon.DungeonRequest)
                    return object;
                if (!$util.isObject(object))
                    throw TypeError(".arcade.dungeon.DungeonRequest: object expected");
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let message = new $root.arcade.dungeon.DungeonRequest();
                if (object.id != null)
                    message.id = String(object.id);
                if (object.action != null)
                    message.action = String(object.action);
                if (object.params != null)
                    if (typeof object.params === "string")
                        $util.base64.decode(object.params, message.params = $util.newBuffer($util.base64.length(object.params)), 0);
                    else if (object.params.length >= 0)
                        message.params = object.params;
                return message;
            };

            /**
             * Creates a plain object from a DungeonRequest message. Also converts values to other types if specified.
             * @function toObject
             * @memberof arcade.dungeon.DungeonRequest
             * @static
             * @param {arcade.dungeon.DungeonRequest} message DungeonRequest
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            DungeonRequest.toObject = function toObject(message, options, q) {
                if (!options)
                    options = {};
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    object.id = "";
                    object.action = "";
                    if (options.bytes === String)
                        object.params = "";
                    else {
                        object.params = [];
                        if (options.bytes !== Array)
                            object.params = $util.newBuffer(object.params);
                    }
                }
                if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                    object.id = message.id;
                if (message.action != null && Object.hasOwnProperty.call(message, "action"))
                    object.action = message.action;
                if (message.params != null && Object.hasOwnProperty.call(message, "params"))
                    object.params = options.bytes === String ? $util.base64.encode(message.params, 0, message.params.length) : options.bytes === Array ? Array.prototype.slice.call(message.params) : message.params;
                return object;
            };

            /**
             * Converts this DungeonRequest to JSON.
             * @function toJSON
             * @memberof arcade.dungeon.DungeonRequest
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            DungeonRequest.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for DungeonRequest
             * @function getTypeUrl
             * @memberof arcade.dungeon.DungeonRequest
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            DungeonRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/arcade.dungeon.DungeonRequest";
            };

            return DungeonRequest;
        })();

        dungeon.DungeonResponse = (function() {

            /**
             * Properties of a DungeonResponse.
             * @memberof arcade.dungeon
             * @interface IDungeonResponse
             * @property {number|null} [code] DungeonResponse code
             * @property {string|null} [action] DungeonResponse action
             * @property {string|null} [id] DungeonResponse id
             * @property {string|null} [msg] DungeonResponse msg
             * @property {Uint8Array|null} [data] DungeonResponse data
             */

            /**
             * Constructs a new DungeonResponse.
             * @memberof arcade.dungeon
             * @classdesc Represents a DungeonResponse.
             * @implements IDungeonResponse
             * @constructor
             * @param {arcade.dungeon.IDungeonResponse=} [properties] Properties to set
             */
            function DungeonResponse(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * DungeonResponse code.
             * @member {number} code
             * @memberof arcade.dungeon.DungeonResponse
             * @instance
             */
            DungeonResponse.prototype.code = 0;

            /**
             * DungeonResponse action.
             * @member {string} action
             * @memberof arcade.dungeon.DungeonResponse
             * @instance
             */
            DungeonResponse.prototype.action = "";

            /**
             * DungeonResponse id.
             * @member {string} id
             * @memberof arcade.dungeon.DungeonResponse
             * @instance
             */
            DungeonResponse.prototype.id = "";

            /**
             * DungeonResponse msg.
             * @member {string} msg
             * @memberof arcade.dungeon.DungeonResponse
             * @instance
             */
            DungeonResponse.prototype.msg = "";

            /**
             * DungeonResponse data.
             * @member {Uint8Array} data
             * @memberof arcade.dungeon.DungeonResponse
             * @instance
             */
            DungeonResponse.prototype.data = $util.newBuffer([]);

            /**
             * Creates a new DungeonResponse instance using the specified properties.
             * @function create
             * @memberof arcade.dungeon.DungeonResponse
             * @static
             * @param {arcade.dungeon.IDungeonResponse=} [properties] Properties to set
             * @returns {arcade.dungeon.DungeonResponse} DungeonResponse instance
             */
            DungeonResponse.create = function create(properties) {
                return new DungeonResponse(properties);
            };

            /**
             * Encodes the specified DungeonResponse message. Does not implicitly {@link arcade.dungeon.DungeonResponse.verify|verify} messages.
             * @function encode
             * @memberof arcade.dungeon.DungeonResponse
             * @static
             * @param {arcade.dungeon.IDungeonResponse} message DungeonResponse message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonResponse.encode = function encode(message, writer, q) {
                if (!writer)
                    writer = $Writer.create();
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                if (message.code != null && Object.hasOwnProperty.call(message, "code"))
                    writer.uint32(/* id 1, wireType 0 =*/8).int32(message.code);
                if (message.action != null && Object.hasOwnProperty.call(message, "action"))
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.action);
                if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.id);
                if (message.msg != null && Object.hasOwnProperty.call(message, "msg"))
                    writer.uint32(/* id 4, wireType 2 =*/34).string(message.msg);
                if (message.data != null && Object.hasOwnProperty.call(message, "data"))
                    writer.uint32(/* id 5, wireType 2 =*/42).bytes(message.data);
                return writer;
            };

            /**
             * Encodes the specified DungeonResponse message, length delimited. Does not implicitly {@link arcade.dungeon.DungeonResponse.verify|verify} messages.
             * @function encodeDelimited
             * @memberof arcade.dungeon.DungeonResponse
             * @static
             * @param {arcade.dungeon.IDungeonResponse} message DungeonResponse message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonResponse.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
            };

            /**
             * Decodes a DungeonResponse message from the specified reader or buffer.
             * @function decode
             * @memberof arcade.dungeon.DungeonResponse
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {arcade.dungeon.DungeonResponse} DungeonResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonResponse.decode = function decode(reader, length, error, long) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (long === undefined)
                    long = 0;
                if (long > $Reader.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let end, message;
                if (length === undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = new $root.arcade.dungeon.DungeonResponse();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.code = reader.int32();
                            break;
                        }
                    case 2: {
                            message.action = reader.string();
                            break;
                        }
                    case 3: {
                            message.id = reader.string();
                            break;
                        }
                    case 4: {
                            message.msg = reader.string();
                            break;
                        }
                    case 5: {
                            message.data = reader.bytes();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7, long);
                        break;
                    }
                }
                if (length !== undefined) {
                    if (reader.pos !== end)
                        throw RangeError("index out of range");
                    reader.len = length;
                }
                return message;
            };

            /**
             * Decodes a DungeonResponse message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof arcade.dungeon.DungeonResponse
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {arcade.dungeon.DungeonResponse} DungeonResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonResponse.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a DungeonResponse message.
             * @function verify
             * @memberof arcade.dungeon.DungeonResponse
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            DungeonResponse.verify = function verify(message, long) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    return "maximum nesting depth exceeded";
                if (message.code != null && Object.hasOwnProperty.call(message, "code"))
                    if (!$util.isInteger(message.code))
                        return "code: integer expected";
                if (message.action != null && Object.hasOwnProperty.call(message, "action"))
                    if (!$util.isString(message.action))
                        return "action: string expected";
                if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                    if (!$util.isString(message.id))
                        return "id: string expected";
                if (message.msg != null && Object.hasOwnProperty.call(message, "msg"))
                    if (!$util.isString(message.msg))
                        return "msg: string expected";
                if (message.data != null && Object.hasOwnProperty.call(message, "data"))
                    if (!(message.data && typeof message.data.length === "number" || $util.isString(message.data)))
                        return "data: buffer expected";
                return null;
            };

            /**
             * Creates a DungeonResponse message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof arcade.dungeon.DungeonResponse
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {arcade.dungeon.DungeonResponse} DungeonResponse
             */
            DungeonResponse.fromObject = function fromObject(object, long) {
                if (object instanceof $root.arcade.dungeon.DungeonResponse)
                    return object;
                if (!$util.isObject(object))
                    throw TypeError(".arcade.dungeon.DungeonResponse: object expected");
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let message = new $root.arcade.dungeon.DungeonResponse();
                if (object.code != null)
                    message.code = object.code | 0;
                if (object.action != null)
                    message.action = String(object.action);
                if (object.id != null)
                    message.id = String(object.id);
                if (object.msg != null)
                    message.msg = String(object.msg);
                if (object.data != null)
                    if (typeof object.data === "string")
                        $util.base64.decode(object.data, message.data = $util.newBuffer($util.base64.length(object.data)), 0);
                    else if (object.data.length >= 0)
                        message.data = object.data;
                return message;
            };

            /**
             * Creates a plain object from a DungeonResponse message. Also converts values to other types if specified.
             * @function toObject
             * @memberof arcade.dungeon.DungeonResponse
             * @static
             * @param {arcade.dungeon.DungeonResponse} message DungeonResponse
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            DungeonResponse.toObject = function toObject(message, options, q) {
                if (!options)
                    options = {};
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    object.code = 0;
                    object.action = "";
                    object.id = "";
                    object.msg = "";
                    if (options.bytes === String)
                        object.data = "";
                    else {
                        object.data = [];
                        if (options.bytes !== Array)
                            object.data = $util.newBuffer(object.data);
                    }
                }
                if (message.code != null && Object.hasOwnProperty.call(message, "code"))
                    object.code = message.code;
                if (message.action != null && Object.hasOwnProperty.call(message, "action"))
                    object.action = message.action;
                if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                    object.id = message.id;
                if (message.msg != null && Object.hasOwnProperty.call(message, "msg"))
                    object.msg = message.msg;
                if (message.data != null && Object.hasOwnProperty.call(message, "data"))
                    object.data = options.bytes === String ? $util.base64.encode(message.data, 0, message.data.length) : options.bytes === Array ? Array.prototype.slice.call(message.data) : message.data;
                return object;
            };

            /**
             * Converts this DungeonResponse to JSON.
             * @function toJSON
             * @memberof arcade.dungeon.DungeonResponse
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            DungeonResponse.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for DungeonResponse
             * @function getTypeUrl
             * @memberof arcade.dungeon.DungeonResponse
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            DungeonResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/arcade.dungeon.DungeonResponse";
            };

            return DungeonResponse;
        })();

        dungeon.DungeonAck = (function() {

            /**
             * Properties of a DungeonAck.
             * @memberof arcade.dungeon
             * @interface IDungeonAck
             * @property {boolean|null} [ok] DungeonAck ok
             */

            /**
             * Constructs a new DungeonAck.
             * @memberof arcade.dungeon
             * @classdesc Represents a DungeonAck.
             * @implements IDungeonAck
             * @constructor
             * @param {arcade.dungeon.IDungeonAck=} [properties] Properties to set
             */
            function DungeonAck(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * DungeonAck ok.
             * @member {boolean} ok
             * @memberof arcade.dungeon.DungeonAck
             * @instance
             */
            DungeonAck.prototype.ok = false;

            /**
             * Creates a new DungeonAck instance using the specified properties.
             * @function create
             * @memberof arcade.dungeon.DungeonAck
             * @static
             * @param {arcade.dungeon.IDungeonAck=} [properties] Properties to set
             * @returns {arcade.dungeon.DungeonAck} DungeonAck instance
             */
            DungeonAck.create = function create(properties) {
                return new DungeonAck(properties);
            };

            /**
             * Encodes the specified DungeonAck message. Does not implicitly {@link arcade.dungeon.DungeonAck.verify|verify} messages.
             * @function encode
             * @memberof arcade.dungeon.DungeonAck
             * @static
             * @param {arcade.dungeon.IDungeonAck} message DungeonAck message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonAck.encode = function encode(message, writer, q) {
                if (!writer)
                    writer = $Writer.create();
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                if (message.ok != null && Object.hasOwnProperty.call(message, "ok"))
                    writer.uint32(/* id 1, wireType 0 =*/8).bool(message.ok);
                return writer;
            };

            /**
             * Encodes the specified DungeonAck message, length delimited. Does not implicitly {@link arcade.dungeon.DungeonAck.verify|verify} messages.
             * @function encodeDelimited
             * @memberof arcade.dungeon.DungeonAck
             * @static
             * @param {arcade.dungeon.IDungeonAck} message DungeonAck message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonAck.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
            };

            /**
             * Decodes a DungeonAck message from the specified reader or buffer.
             * @function decode
             * @memberof arcade.dungeon.DungeonAck
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {arcade.dungeon.DungeonAck} DungeonAck
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonAck.decode = function decode(reader, length, error, long) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (long === undefined)
                    long = 0;
                if (long > $Reader.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let end, message;
                if (length === undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = new $root.arcade.dungeon.DungeonAck();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.ok = reader.bool();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7, long);
                        break;
                    }
                }
                if (length !== undefined) {
                    if (reader.pos !== end)
                        throw RangeError("index out of range");
                    reader.len = length;
                }
                return message;
            };

            /**
             * Decodes a DungeonAck message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof arcade.dungeon.DungeonAck
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {arcade.dungeon.DungeonAck} DungeonAck
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonAck.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a DungeonAck message.
             * @function verify
             * @memberof arcade.dungeon.DungeonAck
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            DungeonAck.verify = function verify(message, long) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    return "maximum nesting depth exceeded";
                if (message.ok != null && Object.hasOwnProperty.call(message, "ok"))
                    if (typeof message.ok !== "boolean")
                        return "ok: boolean expected";
                return null;
            };

            /**
             * Creates a DungeonAck message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof arcade.dungeon.DungeonAck
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {arcade.dungeon.DungeonAck} DungeonAck
             */
            DungeonAck.fromObject = function fromObject(object, long) {
                if (object instanceof $root.arcade.dungeon.DungeonAck)
                    return object;
                if (!$util.isObject(object))
                    throw TypeError(".arcade.dungeon.DungeonAck: object expected");
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let message = new $root.arcade.dungeon.DungeonAck();
                if (object.ok != null)
                    message.ok = Boolean(object.ok);
                return message;
            };

            /**
             * Creates a plain object from a DungeonAck message. Also converts values to other types if specified.
             * @function toObject
             * @memberof arcade.dungeon.DungeonAck
             * @static
             * @param {arcade.dungeon.DungeonAck} message DungeonAck
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            DungeonAck.toObject = function toObject(message, options, q) {
                if (!options)
                    options = {};
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                let object = {};
                if (options.defaults)
                    object.ok = false;
                if (message.ok != null && Object.hasOwnProperty.call(message, "ok"))
                    object.ok = message.ok;
                return object;
            };

            /**
             * Converts this DungeonAck to JSON.
             * @function toJSON
             * @memberof arcade.dungeon.DungeonAck
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            DungeonAck.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for DungeonAck
             * @function getTypeUrl
             * @memberof arcade.dungeon.DungeonAck
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            DungeonAck.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/arcade.dungeon.DungeonAck";
            };

            return DungeonAck;
        })();

        dungeon.DungeonCommand = (function() {

            /**
             * Properties of a DungeonCommand.
             * @memberof arcade.dungeon
             * @interface IDungeonCommand
             * @property {string|null} [type] DungeonCommand type
             * @property {string|null} [skillId] DungeonCommand skillId
             * @property {string|null} [dropId] DungeonCommand dropId
             * @property {string|null} [chestId] DungeonCommand chestId
             */

            /**
             * Constructs a new DungeonCommand.
             * @memberof arcade.dungeon
             * @classdesc Represents a DungeonCommand.
             * @implements IDungeonCommand
             * @constructor
             * @param {arcade.dungeon.IDungeonCommand=} [properties] Properties to set
             */
            function DungeonCommand(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * DungeonCommand type.
             * @member {string} type
             * @memberof arcade.dungeon.DungeonCommand
             * @instance
             */
            DungeonCommand.prototype.type = "";

            /**
             * DungeonCommand skillId.
             * @member {string} skillId
             * @memberof arcade.dungeon.DungeonCommand
             * @instance
             */
            DungeonCommand.prototype.skillId = "";

            /**
             * DungeonCommand dropId.
             * @member {string} dropId
             * @memberof arcade.dungeon.DungeonCommand
             * @instance
             */
            DungeonCommand.prototype.dropId = "";

            /**
             * DungeonCommand chestId.
             * @member {string} chestId
             * @memberof arcade.dungeon.DungeonCommand
             * @instance
             */
            DungeonCommand.prototype.chestId = "";

            /**
             * Creates a new DungeonCommand instance using the specified properties.
             * @function create
             * @memberof arcade.dungeon.DungeonCommand
             * @static
             * @param {arcade.dungeon.IDungeonCommand=} [properties] Properties to set
             * @returns {arcade.dungeon.DungeonCommand} DungeonCommand instance
             */
            DungeonCommand.create = function create(properties) {
                return new DungeonCommand(properties);
            };

            /**
             * Encodes the specified DungeonCommand message. Does not implicitly {@link arcade.dungeon.DungeonCommand.verify|verify} messages.
             * @function encode
             * @memberof arcade.dungeon.DungeonCommand
             * @static
             * @param {arcade.dungeon.IDungeonCommand} message DungeonCommand message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonCommand.encode = function encode(message, writer, q) {
                if (!writer)
                    writer = $Writer.create();
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                if (message.type != null && Object.hasOwnProperty.call(message, "type"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.type);
                if (message.skillId != null && Object.hasOwnProperty.call(message, "skillId"))
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.skillId);
                if (message.dropId != null && Object.hasOwnProperty.call(message, "dropId"))
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.dropId);
                if (message.chestId != null && Object.hasOwnProperty.call(message, "chestId"))
                    writer.uint32(/* id 4, wireType 2 =*/34).string(message.chestId);
                return writer;
            };

            /**
             * Encodes the specified DungeonCommand message, length delimited. Does not implicitly {@link arcade.dungeon.DungeonCommand.verify|verify} messages.
             * @function encodeDelimited
             * @memberof arcade.dungeon.DungeonCommand
             * @static
             * @param {arcade.dungeon.IDungeonCommand} message DungeonCommand message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonCommand.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
            };

            /**
             * Decodes a DungeonCommand message from the specified reader or buffer.
             * @function decode
             * @memberof arcade.dungeon.DungeonCommand
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {arcade.dungeon.DungeonCommand} DungeonCommand
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonCommand.decode = function decode(reader, length, error, long) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (long === undefined)
                    long = 0;
                if (long > $Reader.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let end, message;
                if (length === undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = new $root.arcade.dungeon.DungeonCommand();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.type = reader.string();
                            break;
                        }
                    case 2: {
                            message.skillId = reader.string();
                            break;
                        }
                    case 3: {
                            message.dropId = reader.string();
                            break;
                        }
                    case 4: {
                            message.chestId = reader.string();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7, long);
                        break;
                    }
                }
                if (length !== undefined) {
                    if (reader.pos !== end)
                        throw RangeError("index out of range");
                    reader.len = length;
                }
                return message;
            };

            /**
             * Decodes a DungeonCommand message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof arcade.dungeon.DungeonCommand
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {arcade.dungeon.DungeonCommand} DungeonCommand
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonCommand.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a DungeonCommand message.
             * @function verify
             * @memberof arcade.dungeon.DungeonCommand
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            DungeonCommand.verify = function verify(message, long) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    return "maximum nesting depth exceeded";
                if (message.type != null && Object.hasOwnProperty.call(message, "type"))
                    if (!$util.isString(message.type))
                        return "type: string expected";
                if (message.skillId != null && Object.hasOwnProperty.call(message, "skillId"))
                    if (!$util.isString(message.skillId))
                        return "skillId: string expected";
                if (message.dropId != null && Object.hasOwnProperty.call(message, "dropId"))
                    if (!$util.isString(message.dropId))
                        return "dropId: string expected";
                if (message.chestId != null && Object.hasOwnProperty.call(message, "chestId"))
                    if (!$util.isString(message.chestId))
                        return "chestId: string expected";
                return null;
            };

            /**
             * Creates a DungeonCommand message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof arcade.dungeon.DungeonCommand
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {arcade.dungeon.DungeonCommand} DungeonCommand
             */
            DungeonCommand.fromObject = function fromObject(object, long) {
                if (object instanceof $root.arcade.dungeon.DungeonCommand)
                    return object;
                if (!$util.isObject(object))
                    throw TypeError(".arcade.dungeon.DungeonCommand: object expected");
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let message = new $root.arcade.dungeon.DungeonCommand();
                if (object.type != null)
                    message.type = String(object.type);
                if (object.skillId != null)
                    message.skillId = String(object.skillId);
                if (object.dropId != null)
                    message.dropId = String(object.dropId);
                if (object.chestId != null)
                    message.chestId = String(object.chestId);
                return message;
            };

            /**
             * Creates a plain object from a DungeonCommand message. Also converts values to other types if specified.
             * @function toObject
             * @memberof arcade.dungeon.DungeonCommand
             * @static
             * @param {arcade.dungeon.DungeonCommand} message DungeonCommand
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            DungeonCommand.toObject = function toObject(message, options, q) {
                if (!options)
                    options = {};
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    object.type = "";
                    object.skillId = "";
                    object.dropId = "";
                    object.chestId = "";
                }
                if (message.type != null && Object.hasOwnProperty.call(message, "type"))
                    object.type = message.type;
                if (message.skillId != null && Object.hasOwnProperty.call(message, "skillId"))
                    object.skillId = message.skillId;
                if (message.dropId != null && Object.hasOwnProperty.call(message, "dropId"))
                    object.dropId = message.dropId;
                if (message.chestId != null && Object.hasOwnProperty.call(message, "chestId"))
                    object.chestId = message.chestId;
                return object;
            };

            /**
             * Converts this DungeonCommand to JSON.
             * @function toJSON
             * @memberof arcade.dungeon.DungeonCommand
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            DungeonCommand.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for DungeonCommand
             * @function getTypeUrl
             * @memberof arcade.dungeon.DungeonCommand
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            DungeonCommand.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/arcade.dungeon.DungeonCommand";
            };

            return DungeonCommand;
        })();

        dungeon.DungeonCommandRequest = (function() {

            /**
             * Properties of a DungeonCommandRequest.
             * @memberof arcade.dungeon
             * @interface IDungeonCommandRequest
             * @property {string|null} [roomId] DungeonCommandRequest roomId
             * @property {arcade.dungeon.IDungeonCommand|null} [command] DungeonCommandRequest command
             */

            /**
             * Constructs a new DungeonCommandRequest.
             * @memberof arcade.dungeon
             * @classdesc Represents a DungeonCommandRequest.
             * @implements IDungeonCommandRequest
             * @constructor
             * @param {arcade.dungeon.IDungeonCommandRequest=} [properties] Properties to set
             */
            function DungeonCommandRequest(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * DungeonCommandRequest roomId.
             * @member {string} roomId
             * @memberof arcade.dungeon.DungeonCommandRequest
             * @instance
             */
            DungeonCommandRequest.prototype.roomId = "";

            /**
             * DungeonCommandRequest command.
             * @member {arcade.dungeon.IDungeonCommand|null|undefined} command
             * @memberof arcade.dungeon.DungeonCommandRequest
             * @instance
             */
            DungeonCommandRequest.prototype.command = null;

            /**
             * Creates a new DungeonCommandRequest instance using the specified properties.
             * @function create
             * @memberof arcade.dungeon.DungeonCommandRequest
             * @static
             * @param {arcade.dungeon.IDungeonCommandRequest=} [properties] Properties to set
             * @returns {arcade.dungeon.DungeonCommandRequest} DungeonCommandRequest instance
             */
            DungeonCommandRequest.create = function create(properties) {
                return new DungeonCommandRequest(properties);
            };

            /**
             * Encodes the specified DungeonCommandRequest message. Does not implicitly {@link arcade.dungeon.DungeonCommandRequest.verify|verify} messages.
             * @function encode
             * @memberof arcade.dungeon.DungeonCommandRequest
             * @static
             * @param {arcade.dungeon.IDungeonCommandRequest} message DungeonCommandRequest message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonCommandRequest.encode = function encode(message, writer, q) {
                if (!writer)
                    writer = $Writer.create();
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                if (message.roomId != null && Object.hasOwnProperty.call(message, "roomId"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.roomId);
                if (message.command != null && Object.hasOwnProperty.call(message, "command"))
                    $root.arcade.dungeon.DungeonCommand.encode(message.command, writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
                return writer;
            };

            /**
             * Encodes the specified DungeonCommandRequest message, length delimited. Does not implicitly {@link arcade.dungeon.DungeonCommandRequest.verify|verify} messages.
             * @function encodeDelimited
             * @memberof arcade.dungeon.DungeonCommandRequest
             * @static
             * @param {arcade.dungeon.IDungeonCommandRequest} message DungeonCommandRequest message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonCommandRequest.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
            };

            /**
             * Decodes a DungeonCommandRequest message from the specified reader or buffer.
             * @function decode
             * @memberof arcade.dungeon.DungeonCommandRequest
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {arcade.dungeon.DungeonCommandRequest} DungeonCommandRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonCommandRequest.decode = function decode(reader, length, error, long) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (long === undefined)
                    long = 0;
                if (long > $Reader.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let end, message;
                if (length === undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = new $root.arcade.dungeon.DungeonCommandRequest();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.roomId = reader.string();
                            break;
                        }
                    case 2: {
                            message.command = $root.arcade.dungeon.DungeonCommand.decode(reader, reader.uint32(), undefined, long + 1);
                            break;
                        }
                    default:
                        reader.skipType(tag & 7, long);
                        break;
                    }
                }
                if (length !== undefined) {
                    if (reader.pos !== end)
                        throw RangeError("index out of range");
                    reader.len = length;
                }
                return message;
            };

            /**
             * Decodes a DungeonCommandRequest message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof arcade.dungeon.DungeonCommandRequest
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {arcade.dungeon.DungeonCommandRequest} DungeonCommandRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonCommandRequest.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a DungeonCommandRequest message.
             * @function verify
             * @memberof arcade.dungeon.DungeonCommandRequest
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            DungeonCommandRequest.verify = function verify(message, long) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    return "maximum nesting depth exceeded";
                if (message.roomId != null && Object.hasOwnProperty.call(message, "roomId"))
                    if (!$util.isString(message.roomId))
                        return "roomId: string expected";
                if (message.command != null && Object.hasOwnProperty.call(message, "command")) {
                    let error = $root.arcade.dungeon.DungeonCommand.verify(message.command, long + 1);
                    if (error)
                        return "command." + error;
                }
                return null;
            };

            /**
             * Creates a DungeonCommandRequest message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof arcade.dungeon.DungeonCommandRequest
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {arcade.dungeon.DungeonCommandRequest} DungeonCommandRequest
             */
            DungeonCommandRequest.fromObject = function fromObject(object, long) {
                if (object instanceof $root.arcade.dungeon.DungeonCommandRequest)
                    return object;
                if (!$util.isObject(object))
                    throw TypeError(".arcade.dungeon.DungeonCommandRequest: object expected");
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let message = new $root.arcade.dungeon.DungeonCommandRequest();
                if (object.roomId != null)
                    message.roomId = String(object.roomId);
                if (object.command != null) {
                    if (!$util.isObject(object.command))
                        throw TypeError(".arcade.dungeon.DungeonCommandRequest.command: object expected");
                    message.command = $root.arcade.dungeon.DungeonCommand.fromObject(object.command, long + 1);
                }
                return message;
            };

            /**
             * Creates a plain object from a DungeonCommandRequest message. Also converts values to other types if specified.
             * @function toObject
             * @memberof arcade.dungeon.DungeonCommandRequest
             * @static
             * @param {arcade.dungeon.DungeonCommandRequest} message DungeonCommandRequest
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            DungeonCommandRequest.toObject = function toObject(message, options, q) {
                if (!options)
                    options = {};
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    object.roomId = "";
                    object.command = null;
                }
                if (message.roomId != null && Object.hasOwnProperty.call(message, "roomId"))
                    object.roomId = message.roomId;
                if (message.command != null && Object.hasOwnProperty.call(message, "command"))
                    object.command = $root.arcade.dungeon.DungeonCommand.toObject(message.command, options, q + 1);
                return object;
            };

            /**
             * Converts this DungeonCommandRequest to JSON.
             * @function toJSON
             * @memberof arcade.dungeon.DungeonCommandRequest
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            DungeonCommandRequest.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for DungeonCommandRequest
             * @function getTypeUrl
             * @memberof arcade.dungeon.DungeonCommandRequest
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            DungeonCommandRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/arcade.dungeon.DungeonCommandRequest";
            };

            return DungeonCommandRequest;
        })();

        dungeon.DungeonCommandRelay = (function() {

            /**
             * Properties of a DungeonCommandRelay.
             * @memberof arcade.dungeon
             * @interface IDungeonCommandRelay
             * @property {string|null} [playerId] DungeonCommandRelay playerId
             * @property {arcade.dungeon.IDungeonCommand|null} [command] DungeonCommandRelay command
             */

            /**
             * Constructs a new DungeonCommandRelay.
             * @memberof arcade.dungeon
             * @classdesc Represents a DungeonCommandRelay.
             * @implements IDungeonCommandRelay
             * @constructor
             * @param {arcade.dungeon.IDungeonCommandRelay=} [properties] Properties to set
             */
            function DungeonCommandRelay(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * DungeonCommandRelay playerId.
             * @member {string} playerId
             * @memberof arcade.dungeon.DungeonCommandRelay
             * @instance
             */
            DungeonCommandRelay.prototype.playerId = "";

            /**
             * DungeonCommandRelay command.
             * @member {arcade.dungeon.IDungeonCommand|null|undefined} command
             * @memberof arcade.dungeon.DungeonCommandRelay
             * @instance
             */
            DungeonCommandRelay.prototype.command = null;

            /**
             * Creates a new DungeonCommandRelay instance using the specified properties.
             * @function create
             * @memberof arcade.dungeon.DungeonCommandRelay
             * @static
             * @param {arcade.dungeon.IDungeonCommandRelay=} [properties] Properties to set
             * @returns {arcade.dungeon.DungeonCommandRelay} DungeonCommandRelay instance
             */
            DungeonCommandRelay.create = function create(properties) {
                return new DungeonCommandRelay(properties);
            };

            /**
             * Encodes the specified DungeonCommandRelay message. Does not implicitly {@link arcade.dungeon.DungeonCommandRelay.verify|verify} messages.
             * @function encode
             * @memberof arcade.dungeon.DungeonCommandRelay
             * @static
             * @param {arcade.dungeon.IDungeonCommandRelay} message DungeonCommandRelay message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonCommandRelay.encode = function encode(message, writer, q) {
                if (!writer)
                    writer = $Writer.create();
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                if (message.playerId != null && Object.hasOwnProperty.call(message, "playerId"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.playerId);
                if (message.command != null && Object.hasOwnProperty.call(message, "command"))
                    $root.arcade.dungeon.DungeonCommand.encode(message.command, writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
                return writer;
            };

            /**
             * Encodes the specified DungeonCommandRelay message, length delimited. Does not implicitly {@link arcade.dungeon.DungeonCommandRelay.verify|verify} messages.
             * @function encodeDelimited
             * @memberof arcade.dungeon.DungeonCommandRelay
             * @static
             * @param {arcade.dungeon.IDungeonCommandRelay} message DungeonCommandRelay message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonCommandRelay.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
            };

            /**
             * Decodes a DungeonCommandRelay message from the specified reader or buffer.
             * @function decode
             * @memberof arcade.dungeon.DungeonCommandRelay
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {arcade.dungeon.DungeonCommandRelay} DungeonCommandRelay
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonCommandRelay.decode = function decode(reader, length, error, long) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (long === undefined)
                    long = 0;
                if (long > $Reader.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let end, message;
                if (length === undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = new $root.arcade.dungeon.DungeonCommandRelay();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.playerId = reader.string();
                            break;
                        }
                    case 2: {
                            message.command = $root.arcade.dungeon.DungeonCommand.decode(reader, reader.uint32(), undefined, long + 1);
                            break;
                        }
                    default:
                        reader.skipType(tag & 7, long);
                        break;
                    }
                }
                if (length !== undefined) {
                    if (reader.pos !== end)
                        throw RangeError("index out of range");
                    reader.len = length;
                }
                return message;
            };

            /**
             * Decodes a DungeonCommandRelay message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof arcade.dungeon.DungeonCommandRelay
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {arcade.dungeon.DungeonCommandRelay} DungeonCommandRelay
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonCommandRelay.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a DungeonCommandRelay message.
             * @function verify
             * @memberof arcade.dungeon.DungeonCommandRelay
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            DungeonCommandRelay.verify = function verify(message, long) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    return "maximum nesting depth exceeded";
                if (message.playerId != null && Object.hasOwnProperty.call(message, "playerId"))
                    if (!$util.isString(message.playerId))
                        return "playerId: string expected";
                if (message.command != null && Object.hasOwnProperty.call(message, "command")) {
                    let error = $root.arcade.dungeon.DungeonCommand.verify(message.command, long + 1);
                    if (error)
                        return "command." + error;
                }
                return null;
            };

            /**
             * Creates a DungeonCommandRelay message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof arcade.dungeon.DungeonCommandRelay
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {arcade.dungeon.DungeonCommandRelay} DungeonCommandRelay
             */
            DungeonCommandRelay.fromObject = function fromObject(object, long) {
                if (object instanceof $root.arcade.dungeon.DungeonCommandRelay)
                    return object;
                if (!$util.isObject(object))
                    throw TypeError(".arcade.dungeon.DungeonCommandRelay: object expected");
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let message = new $root.arcade.dungeon.DungeonCommandRelay();
                if (object.playerId != null)
                    message.playerId = String(object.playerId);
                if (object.command != null) {
                    if (!$util.isObject(object.command))
                        throw TypeError(".arcade.dungeon.DungeonCommandRelay.command: object expected");
                    message.command = $root.arcade.dungeon.DungeonCommand.fromObject(object.command, long + 1);
                }
                return message;
            };

            /**
             * Creates a plain object from a DungeonCommandRelay message. Also converts values to other types if specified.
             * @function toObject
             * @memberof arcade.dungeon.DungeonCommandRelay
             * @static
             * @param {arcade.dungeon.DungeonCommandRelay} message DungeonCommandRelay
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            DungeonCommandRelay.toObject = function toObject(message, options, q) {
                if (!options)
                    options = {};
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    object.playerId = "";
                    object.command = null;
                }
                if (message.playerId != null && Object.hasOwnProperty.call(message, "playerId"))
                    object.playerId = message.playerId;
                if (message.command != null && Object.hasOwnProperty.call(message, "command"))
                    object.command = $root.arcade.dungeon.DungeonCommand.toObject(message.command, options, q + 1);
                return object;
            };

            /**
             * Converts this DungeonCommandRelay to JSON.
             * @function toJSON
             * @memberof arcade.dungeon.DungeonCommandRelay
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            DungeonCommandRelay.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for DungeonCommandRelay
             * @function getTypeUrl
             * @memberof arcade.dungeon.DungeonCommandRelay
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            DungeonCommandRelay.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/arcade.dungeon.DungeonCommandRelay";
            };

            return DungeonCommandRelay;
        })();

        dungeon.DungeonPresenceSnapshot = (function() {

            /**
             * Properties of a DungeonPresenceSnapshot.
             * @memberof arcade.dungeon
             * @interface IDungeonPresenceSnapshot
             * @property {number|null} [slot] DungeonPresenceSnapshot slot
             * @property {number|null} [x] DungeonPresenceSnapshot x
             * @property {number|null} [y] DungeonPresenceSnapshot y
             * @property {string|null} [facing] DungeonPresenceSnapshot facing
             * @property {boolean|null} [moving] DungeonPresenceSnapshot moving
             * @property {boolean|null} [attacking] DungeonPresenceSnapshot attacking
             * @property {boolean|null} [dead] DungeonPresenceSnapshot dead
             * @property {number|null} [lastAttackElapsedMs] DungeonPresenceSnapshot lastAttackElapsedMs
             * @property {number|null} [lastContactElapsedMs] DungeonPresenceSnapshot lastContactElapsedMs
             * @property {Object.<string,number>|null} [skillCooldownRemainingMs] DungeonPresenceSnapshot skillCooldownRemainingMs
             */

            /**
             * Constructs a new DungeonPresenceSnapshot.
             * @memberof arcade.dungeon
             * @classdesc Represents a DungeonPresenceSnapshot.
             * @implements IDungeonPresenceSnapshot
             * @constructor
             * @param {arcade.dungeon.IDungeonPresenceSnapshot=} [properties] Properties to set
             */
            function DungeonPresenceSnapshot(properties) {
                this.skillCooldownRemainingMs = {};
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * DungeonPresenceSnapshot slot.
             * @member {number|null|undefined} slot
             * @memberof arcade.dungeon.DungeonPresenceSnapshot
             * @instance
             */
            DungeonPresenceSnapshot.prototype.slot = null;

            /**
             * DungeonPresenceSnapshot x.
             * @member {number|null|undefined} x
             * @memberof arcade.dungeon.DungeonPresenceSnapshot
             * @instance
             */
            DungeonPresenceSnapshot.prototype.x = null;

            /**
             * DungeonPresenceSnapshot y.
             * @member {number|null|undefined} y
             * @memberof arcade.dungeon.DungeonPresenceSnapshot
             * @instance
             */
            DungeonPresenceSnapshot.prototype.y = null;

            /**
             * DungeonPresenceSnapshot facing.
             * @member {string} facing
             * @memberof arcade.dungeon.DungeonPresenceSnapshot
             * @instance
             */
            DungeonPresenceSnapshot.prototype.facing = "";

            /**
             * DungeonPresenceSnapshot moving.
             * @member {boolean} moving
             * @memberof arcade.dungeon.DungeonPresenceSnapshot
             * @instance
             */
            DungeonPresenceSnapshot.prototype.moving = false;

            /**
             * DungeonPresenceSnapshot attacking.
             * @member {boolean} attacking
             * @memberof arcade.dungeon.DungeonPresenceSnapshot
             * @instance
             */
            DungeonPresenceSnapshot.prototype.attacking = false;

            /**
             * DungeonPresenceSnapshot dead.
             * @member {boolean} dead
             * @memberof arcade.dungeon.DungeonPresenceSnapshot
             * @instance
             */
            DungeonPresenceSnapshot.prototype.dead = false;

            /**
             * DungeonPresenceSnapshot lastAttackElapsedMs.
             * @member {number|null|undefined} lastAttackElapsedMs
             * @memberof arcade.dungeon.DungeonPresenceSnapshot
             * @instance
             */
            DungeonPresenceSnapshot.prototype.lastAttackElapsedMs = null;

            /**
             * DungeonPresenceSnapshot lastContactElapsedMs.
             * @member {number|null|undefined} lastContactElapsedMs
             * @memberof arcade.dungeon.DungeonPresenceSnapshot
             * @instance
             */
            DungeonPresenceSnapshot.prototype.lastContactElapsedMs = null;

            /**
             * DungeonPresenceSnapshot skillCooldownRemainingMs.
             * @member {Object.<string,number>} skillCooldownRemainingMs
             * @memberof arcade.dungeon.DungeonPresenceSnapshot
             * @instance
             */
            DungeonPresenceSnapshot.prototype.skillCooldownRemainingMs = $util.emptyObject;

            // OneOf field names bound to virtual getters and setters
            let $oneOfFields;

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonPresenceSnapshot.prototype, "_slot", {
                get: $util.oneOfGetter($oneOfFields = ["slot"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonPresenceSnapshot.prototype, "_x", {
                get: $util.oneOfGetter($oneOfFields = ["x"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonPresenceSnapshot.prototype, "_y", {
                get: $util.oneOfGetter($oneOfFields = ["y"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonPresenceSnapshot.prototype, "_lastAttackElapsedMs", {
                get: $util.oneOfGetter($oneOfFields = ["lastAttackElapsedMs"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonPresenceSnapshot.prototype, "_lastContactElapsedMs", {
                get: $util.oneOfGetter($oneOfFields = ["lastContactElapsedMs"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            /**
             * Creates a new DungeonPresenceSnapshot instance using the specified properties.
             * @function create
             * @memberof arcade.dungeon.DungeonPresenceSnapshot
             * @static
             * @param {arcade.dungeon.IDungeonPresenceSnapshot=} [properties] Properties to set
             * @returns {arcade.dungeon.DungeonPresenceSnapshot} DungeonPresenceSnapshot instance
             */
            DungeonPresenceSnapshot.create = function create(properties) {
                return new DungeonPresenceSnapshot(properties);
            };

            /**
             * Encodes the specified DungeonPresenceSnapshot message. Does not implicitly {@link arcade.dungeon.DungeonPresenceSnapshot.verify|verify} messages.
             * @function encode
             * @memberof arcade.dungeon.DungeonPresenceSnapshot
             * @static
             * @param {arcade.dungeon.IDungeonPresenceSnapshot} message DungeonPresenceSnapshot message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonPresenceSnapshot.encode = function encode(message, writer, q) {
                if (!writer)
                    writer = $Writer.create();
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                if (message.slot != null && Object.hasOwnProperty.call(message, "slot"))
                    writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.slot);
                if (message.x != null && Object.hasOwnProperty.call(message, "x"))
                    writer.uint32(/* id 2, wireType 5 =*/21).float(message.x);
                if (message.y != null && Object.hasOwnProperty.call(message, "y"))
                    writer.uint32(/* id 3, wireType 5 =*/29).float(message.y);
                if (message.facing != null && Object.hasOwnProperty.call(message, "facing"))
                    writer.uint32(/* id 6, wireType 2 =*/50).string(message.facing);
                if (message.moving != null && Object.hasOwnProperty.call(message, "moving"))
                    writer.uint32(/* id 7, wireType 0 =*/56).bool(message.moving);
                if (message.attacking != null && Object.hasOwnProperty.call(message, "attacking"))
                    writer.uint32(/* id 8, wireType 0 =*/64).bool(message.attacking);
                if (message.dead != null && Object.hasOwnProperty.call(message, "dead"))
                    writer.uint32(/* id 9, wireType 0 =*/72).bool(message.dead);
                if (message.lastAttackElapsedMs != null && Object.hasOwnProperty.call(message, "lastAttackElapsedMs"))
                    writer.uint32(/* id 10, wireType 1 =*/81).double(message.lastAttackElapsedMs);
                if (message.lastContactElapsedMs != null && Object.hasOwnProperty.call(message, "lastContactElapsedMs"))
                    writer.uint32(/* id 11, wireType 1 =*/89).double(message.lastContactElapsedMs);
                if (message.skillCooldownRemainingMs != null && Object.hasOwnProperty.call(message, "skillCooldownRemainingMs"))
                    for (let keys = Object.keys(message.skillCooldownRemainingMs), i = 0; i < keys.length; ++i)
                        writer.uint32(/* id 12, wireType 2 =*/98).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]).uint32(/* id 2, wireType 1 =*/17).double(message.skillCooldownRemainingMs[keys[i]]).ldelim();
                return writer;
            };

            /**
             * Encodes the specified DungeonPresenceSnapshot message, length delimited. Does not implicitly {@link arcade.dungeon.DungeonPresenceSnapshot.verify|verify} messages.
             * @function encodeDelimited
             * @memberof arcade.dungeon.DungeonPresenceSnapshot
             * @static
             * @param {arcade.dungeon.IDungeonPresenceSnapshot} message DungeonPresenceSnapshot message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonPresenceSnapshot.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
            };

            /**
             * Decodes a DungeonPresenceSnapshot message from the specified reader or buffer.
             * @function decode
             * @memberof arcade.dungeon.DungeonPresenceSnapshot
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {arcade.dungeon.DungeonPresenceSnapshot} DungeonPresenceSnapshot
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonPresenceSnapshot.decode = function decode(reader, length, error, long) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (long === undefined)
                    long = 0;
                if (long > $Reader.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let end, message, key, value;
                if (length === undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = new $root.arcade.dungeon.DungeonPresenceSnapshot();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.slot = reader.uint32();
                            break;
                        }
                    case 2: {
                            message.x = reader.float();
                            break;
                        }
                    case 3: {
                            message.y = reader.float();
                            break;
                        }
                    case 6: {
                            message.facing = reader.string();
                            break;
                        }
                    case 7: {
                            message.moving = reader.bool();
                            break;
                        }
                    case 8: {
                            message.attacking = reader.bool();
                            break;
                        }
                    case 9: {
                            message.dead = reader.bool();
                            break;
                        }
                    case 10: {
                            message.lastAttackElapsedMs = reader.double();
                            break;
                        }
                    case 11: {
                            message.lastContactElapsedMs = reader.double();
                            break;
                        }
                    case 12: {
                            if (message.skillCooldownRemainingMs === $util.emptyObject)
                                message.skillCooldownRemainingMs = {};
                            let end2 = reader.uint32() + reader.pos;
                            if (end2 > reader.len)
                                throw RangeError("index out of range");
                            reader.len = end2;
                            key = "";
                            value = 0;
                            while (reader.pos < end2) {
                                let tag2 = reader.uint32();
                                switch (tag2 >>> 3) {
                                case 1:
                                    key = reader.string();
                                    break;
                                case 2:
                                    value = reader.double();
                                    break;
                                default:
                                    reader.skipType(tag2 & 7, long);
                                    break;
                                }
                            }
                            if (reader.pos !== end2)
                                throw RangeError("index out of range");
                            reader.len = end;
                            if (key === "__proto__")
                                $util.makeProp(message.skillCooldownRemainingMs, key);
                            message.skillCooldownRemainingMs[key] = value;
                            break;
                        }
                    default:
                        reader.skipType(tag & 7, long);
                        break;
                    }
                }
                if (length !== undefined) {
                    if (reader.pos !== end)
                        throw RangeError("index out of range");
                    reader.len = length;
                }
                return message;
            };

            /**
             * Decodes a DungeonPresenceSnapshot message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof arcade.dungeon.DungeonPresenceSnapshot
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {arcade.dungeon.DungeonPresenceSnapshot} DungeonPresenceSnapshot
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonPresenceSnapshot.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a DungeonPresenceSnapshot message.
             * @function verify
             * @memberof arcade.dungeon.DungeonPresenceSnapshot
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            DungeonPresenceSnapshot.verify = function verify(message, long) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    return "maximum nesting depth exceeded";
                let properties = {};
                if (message.slot != null && Object.hasOwnProperty.call(message, "slot")) {
                    properties._slot = 1;
                    if (!$util.isInteger(message.slot))
                        return "slot: integer expected";
                }
                if (message.x != null && Object.hasOwnProperty.call(message, "x")) {
                    properties._x = 1;
                    if (typeof message.x !== "number")
                        return "x: number expected";
                }
                if (message.y != null && Object.hasOwnProperty.call(message, "y")) {
                    properties._y = 1;
                    if (typeof message.y !== "number")
                        return "y: number expected";
                }
                if (message.facing != null && Object.hasOwnProperty.call(message, "facing"))
                    if (!$util.isString(message.facing))
                        return "facing: string expected";
                if (message.moving != null && Object.hasOwnProperty.call(message, "moving"))
                    if (typeof message.moving !== "boolean")
                        return "moving: boolean expected";
                if (message.attacking != null && Object.hasOwnProperty.call(message, "attacking"))
                    if (typeof message.attacking !== "boolean")
                        return "attacking: boolean expected";
                if (message.dead != null && Object.hasOwnProperty.call(message, "dead"))
                    if (typeof message.dead !== "boolean")
                        return "dead: boolean expected";
                if (message.lastAttackElapsedMs != null && Object.hasOwnProperty.call(message, "lastAttackElapsedMs")) {
                    properties._lastAttackElapsedMs = 1;
                    if (typeof message.lastAttackElapsedMs !== "number")
                        return "lastAttackElapsedMs: number expected";
                }
                if (message.lastContactElapsedMs != null && Object.hasOwnProperty.call(message, "lastContactElapsedMs")) {
                    properties._lastContactElapsedMs = 1;
                    if (typeof message.lastContactElapsedMs !== "number")
                        return "lastContactElapsedMs: number expected";
                }
                if (message.skillCooldownRemainingMs != null && Object.hasOwnProperty.call(message, "skillCooldownRemainingMs")) {
                    if (!$util.isObject(message.skillCooldownRemainingMs))
                        return "skillCooldownRemainingMs: object expected";
                    let key = Object.keys(message.skillCooldownRemainingMs);
                    for (let i = 0; i < key.length; ++i)
                        if (typeof message.skillCooldownRemainingMs[key[i]] !== "number")
                            return "skillCooldownRemainingMs: number{k:string} expected";
                }
                return null;
            };

            /**
             * Creates a DungeonPresenceSnapshot message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof arcade.dungeon.DungeonPresenceSnapshot
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {arcade.dungeon.DungeonPresenceSnapshot} DungeonPresenceSnapshot
             */
            DungeonPresenceSnapshot.fromObject = function fromObject(object, long) {
                if (object instanceof $root.arcade.dungeon.DungeonPresenceSnapshot)
                    return object;
                if (!$util.isObject(object))
                    throw TypeError(".arcade.dungeon.DungeonPresenceSnapshot: object expected");
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let message = new $root.arcade.dungeon.DungeonPresenceSnapshot();
                if (object.slot != null)
                    message.slot = object.slot >>> 0;
                if (object.x != null)
                    message.x = Number(object.x);
                if (object.y != null)
                    message.y = Number(object.y);
                if (object.facing != null)
                    message.facing = String(object.facing);
                if (object.moving != null)
                    message.moving = Boolean(object.moving);
                if (object.attacking != null)
                    message.attacking = Boolean(object.attacking);
                if (object.dead != null)
                    message.dead = Boolean(object.dead);
                if (object.lastAttackElapsedMs != null)
                    message.lastAttackElapsedMs = Number(object.lastAttackElapsedMs);
                if (object.lastContactElapsedMs != null)
                    message.lastContactElapsedMs = Number(object.lastContactElapsedMs);
                if (object.skillCooldownRemainingMs) {
                    if (!$util.isObject(object.skillCooldownRemainingMs))
                        throw TypeError(".arcade.dungeon.DungeonPresenceSnapshot.skillCooldownRemainingMs: object expected");
                    message.skillCooldownRemainingMs = {};
                    for (let keys = Object.keys(object.skillCooldownRemainingMs), i = 0; i < keys.length; ++i) {
                        if (keys[i] === "__proto__")
                            $util.makeProp(message.skillCooldownRemainingMs, keys[i]);
                        message.skillCooldownRemainingMs[keys[i]] = Number(object.skillCooldownRemainingMs[keys[i]]);
                    }
                }
                return message;
            };

            /**
             * Creates a plain object from a DungeonPresenceSnapshot message. Also converts values to other types if specified.
             * @function toObject
             * @memberof arcade.dungeon.DungeonPresenceSnapshot
             * @static
             * @param {arcade.dungeon.DungeonPresenceSnapshot} message DungeonPresenceSnapshot
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            DungeonPresenceSnapshot.toObject = function toObject(message, options, q) {
                if (!options)
                    options = {};
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                let object = {};
                if (options.objects || options.defaults)
                    object.skillCooldownRemainingMs = {};
                if (options.defaults) {
                    object.facing = "";
                    object.moving = false;
                    object.attacking = false;
                    object.dead = false;
                }
                if (message.slot != null && Object.hasOwnProperty.call(message, "slot")) {
                    object.slot = message.slot;
                    if (options.oneofs)
                        object._slot = "slot";
                }
                if (message.x != null && Object.hasOwnProperty.call(message, "x")) {
                    object.x = options.json && !isFinite(message.x) ? String(message.x) : message.x;
                    if (options.oneofs)
                        object._x = "x";
                }
                if (message.y != null && Object.hasOwnProperty.call(message, "y")) {
                    object.y = options.json && !isFinite(message.y) ? String(message.y) : message.y;
                    if (options.oneofs)
                        object._y = "y";
                }
                if (message.facing != null && Object.hasOwnProperty.call(message, "facing"))
                    object.facing = message.facing;
                if (message.moving != null && Object.hasOwnProperty.call(message, "moving"))
                    object.moving = message.moving;
                if (message.attacking != null && Object.hasOwnProperty.call(message, "attacking"))
                    object.attacking = message.attacking;
                if (message.dead != null && Object.hasOwnProperty.call(message, "dead"))
                    object.dead = message.dead;
                if (message.lastAttackElapsedMs != null && Object.hasOwnProperty.call(message, "lastAttackElapsedMs")) {
                    object.lastAttackElapsedMs = options.json && !isFinite(message.lastAttackElapsedMs) ? String(message.lastAttackElapsedMs) : message.lastAttackElapsedMs;
                    if (options.oneofs)
                        object._lastAttackElapsedMs = "lastAttackElapsedMs";
                }
                if (message.lastContactElapsedMs != null && Object.hasOwnProperty.call(message, "lastContactElapsedMs")) {
                    object.lastContactElapsedMs = options.json && !isFinite(message.lastContactElapsedMs) ? String(message.lastContactElapsedMs) : message.lastContactElapsedMs;
                    if (options.oneofs)
                        object._lastContactElapsedMs = "lastContactElapsedMs";
                }
                let keys2;
                if (message.skillCooldownRemainingMs && (keys2 = Object.keys(message.skillCooldownRemainingMs)).length) {
                    object.skillCooldownRemainingMs = {};
                    for (let j = 0; j < keys2.length; ++j) {
                        if (keys2[j] === "__proto__")
                            $util.makeProp(object.skillCooldownRemainingMs, keys2[j]);
                        object.skillCooldownRemainingMs[keys2[j]] = options.json && !isFinite(message.skillCooldownRemainingMs[keys2[j]]) ? String(message.skillCooldownRemainingMs[keys2[j]]) : message.skillCooldownRemainingMs[keys2[j]];
                    }
                }
                return object;
            };

            /**
             * Converts this DungeonPresenceSnapshot to JSON.
             * @function toJSON
             * @memberof arcade.dungeon.DungeonPresenceSnapshot
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            DungeonPresenceSnapshot.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for DungeonPresenceSnapshot
             * @function getTypeUrl
             * @memberof arcade.dungeon.DungeonPresenceSnapshot
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            DungeonPresenceSnapshot.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/arcade.dungeon.DungeonPresenceSnapshot";
            };

            return DungeonPresenceSnapshot;
        })();

        dungeon.DungeonStatSet = (function() {

            /**
             * Properties of a DungeonStatSet.
             * @memberof arcade.dungeon
             * @interface IDungeonStatSet
             * @property {number|null} [damage] DungeonStatSet damage
             * @property {number|null} [critChance] DungeonStatSet critChance
             * @property {number|null} [speed] DungeonStatSet speed
             * @property {number|null} [maxHp] DungeonStatSet maxHp
             */

            /**
             * Constructs a new DungeonStatSet.
             * @memberof arcade.dungeon
             * @classdesc Represents a DungeonStatSet.
             * @implements IDungeonStatSet
             * @constructor
             * @param {arcade.dungeon.IDungeonStatSet=} [properties] Properties to set
             */
            function DungeonStatSet(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * DungeonStatSet damage.
             * @member {number|null|undefined} damage
             * @memberof arcade.dungeon.DungeonStatSet
             * @instance
             */
            DungeonStatSet.prototype.damage = null;

            /**
             * DungeonStatSet critChance.
             * @member {number|null|undefined} critChance
             * @memberof arcade.dungeon.DungeonStatSet
             * @instance
             */
            DungeonStatSet.prototype.critChance = null;

            /**
             * DungeonStatSet speed.
             * @member {number|null|undefined} speed
             * @memberof arcade.dungeon.DungeonStatSet
             * @instance
             */
            DungeonStatSet.prototype.speed = null;

            /**
             * DungeonStatSet maxHp.
             * @member {number|null|undefined} maxHp
             * @memberof arcade.dungeon.DungeonStatSet
             * @instance
             */
            DungeonStatSet.prototype.maxHp = null;

            // OneOf field names bound to virtual getters and setters
            let $oneOfFields;

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonStatSet.prototype, "_damage", {
                get: $util.oneOfGetter($oneOfFields = ["damage"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonStatSet.prototype, "_critChance", {
                get: $util.oneOfGetter($oneOfFields = ["critChance"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonStatSet.prototype, "_speed", {
                get: $util.oneOfGetter($oneOfFields = ["speed"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonStatSet.prototype, "_maxHp", {
                get: $util.oneOfGetter($oneOfFields = ["maxHp"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            /**
             * Creates a new DungeonStatSet instance using the specified properties.
             * @function create
             * @memberof arcade.dungeon.DungeonStatSet
             * @static
             * @param {arcade.dungeon.IDungeonStatSet=} [properties] Properties to set
             * @returns {arcade.dungeon.DungeonStatSet} DungeonStatSet instance
             */
            DungeonStatSet.create = function create(properties) {
                return new DungeonStatSet(properties);
            };

            /**
             * Encodes the specified DungeonStatSet message. Does not implicitly {@link arcade.dungeon.DungeonStatSet.verify|verify} messages.
             * @function encode
             * @memberof arcade.dungeon.DungeonStatSet
             * @static
             * @param {arcade.dungeon.IDungeonStatSet} message DungeonStatSet message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonStatSet.encode = function encode(message, writer, q) {
                if (!writer)
                    writer = $Writer.create();
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                if (message.damage != null && Object.hasOwnProperty.call(message, "damage"))
                    writer.uint32(/* id 1, wireType 1 =*/9).double(message.damage);
                if (message.critChance != null && Object.hasOwnProperty.call(message, "critChance"))
                    writer.uint32(/* id 2, wireType 1 =*/17).double(message.critChance);
                if (message.speed != null && Object.hasOwnProperty.call(message, "speed"))
                    writer.uint32(/* id 3, wireType 1 =*/25).double(message.speed);
                if (message.maxHp != null && Object.hasOwnProperty.call(message, "maxHp"))
                    writer.uint32(/* id 4, wireType 1 =*/33).double(message.maxHp);
                return writer;
            };

            /**
             * Encodes the specified DungeonStatSet message, length delimited. Does not implicitly {@link arcade.dungeon.DungeonStatSet.verify|verify} messages.
             * @function encodeDelimited
             * @memberof arcade.dungeon.DungeonStatSet
             * @static
             * @param {arcade.dungeon.IDungeonStatSet} message DungeonStatSet message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonStatSet.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
            };

            /**
             * Decodes a DungeonStatSet message from the specified reader or buffer.
             * @function decode
             * @memberof arcade.dungeon.DungeonStatSet
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {arcade.dungeon.DungeonStatSet} DungeonStatSet
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonStatSet.decode = function decode(reader, length, error, long) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (long === undefined)
                    long = 0;
                if (long > $Reader.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let end, message;
                if (length === undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = new $root.arcade.dungeon.DungeonStatSet();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.damage = reader.double();
                            break;
                        }
                    case 2: {
                            message.critChance = reader.double();
                            break;
                        }
                    case 3: {
                            message.speed = reader.double();
                            break;
                        }
                    case 4: {
                            message.maxHp = reader.double();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7, long);
                        break;
                    }
                }
                if (length !== undefined) {
                    if (reader.pos !== end)
                        throw RangeError("index out of range");
                    reader.len = length;
                }
                return message;
            };

            /**
             * Decodes a DungeonStatSet message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof arcade.dungeon.DungeonStatSet
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {arcade.dungeon.DungeonStatSet} DungeonStatSet
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonStatSet.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a DungeonStatSet message.
             * @function verify
             * @memberof arcade.dungeon.DungeonStatSet
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            DungeonStatSet.verify = function verify(message, long) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    return "maximum nesting depth exceeded";
                let properties = {};
                if (message.damage != null && Object.hasOwnProperty.call(message, "damage")) {
                    properties._damage = 1;
                    if (typeof message.damage !== "number")
                        return "damage: number expected";
                }
                if (message.critChance != null && Object.hasOwnProperty.call(message, "critChance")) {
                    properties._critChance = 1;
                    if (typeof message.critChance !== "number")
                        return "critChance: number expected";
                }
                if (message.speed != null && Object.hasOwnProperty.call(message, "speed")) {
                    properties._speed = 1;
                    if (typeof message.speed !== "number")
                        return "speed: number expected";
                }
                if (message.maxHp != null && Object.hasOwnProperty.call(message, "maxHp")) {
                    properties._maxHp = 1;
                    if (typeof message.maxHp !== "number")
                        return "maxHp: number expected";
                }
                return null;
            };

            /**
             * Creates a DungeonStatSet message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof arcade.dungeon.DungeonStatSet
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {arcade.dungeon.DungeonStatSet} DungeonStatSet
             */
            DungeonStatSet.fromObject = function fromObject(object, long) {
                if (object instanceof $root.arcade.dungeon.DungeonStatSet)
                    return object;
                if (!$util.isObject(object))
                    throw TypeError(".arcade.dungeon.DungeonStatSet: object expected");
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let message = new $root.arcade.dungeon.DungeonStatSet();
                if (object.damage != null)
                    message.damage = Number(object.damage);
                if (object.critChance != null)
                    message.critChance = Number(object.critChance);
                if (object.speed != null)
                    message.speed = Number(object.speed);
                if (object.maxHp != null)
                    message.maxHp = Number(object.maxHp);
                return message;
            };

            /**
             * Creates a plain object from a DungeonStatSet message. Also converts values to other types if specified.
             * @function toObject
             * @memberof arcade.dungeon.DungeonStatSet
             * @static
             * @param {arcade.dungeon.DungeonStatSet} message DungeonStatSet
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            DungeonStatSet.toObject = function toObject(message, options, q) {
                if (!options)
                    options = {};
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                let object = {};
                if (message.damage != null && Object.hasOwnProperty.call(message, "damage")) {
                    object.damage = options.json && !isFinite(message.damage) ? String(message.damage) : message.damage;
                    if (options.oneofs)
                        object._damage = "damage";
                }
                if (message.critChance != null && Object.hasOwnProperty.call(message, "critChance")) {
                    object.critChance = options.json && !isFinite(message.critChance) ? String(message.critChance) : message.critChance;
                    if (options.oneofs)
                        object._critChance = "critChance";
                }
                if (message.speed != null && Object.hasOwnProperty.call(message, "speed")) {
                    object.speed = options.json && !isFinite(message.speed) ? String(message.speed) : message.speed;
                    if (options.oneofs)
                        object._speed = "speed";
                }
                if (message.maxHp != null && Object.hasOwnProperty.call(message, "maxHp")) {
                    object.maxHp = options.json && !isFinite(message.maxHp) ? String(message.maxHp) : message.maxHp;
                    if (options.oneofs)
                        object._maxHp = "maxHp";
                }
                return object;
            };

            /**
             * Converts this DungeonStatSet to JSON.
             * @function toJSON
             * @memberof arcade.dungeon.DungeonStatSet
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            DungeonStatSet.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for DungeonStatSet
             * @function getTypeUrl
             * @memberof arcade.dungeon.DungeonStatSet
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            DungeonStatSet.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/arcade.dungeon.DungeonStatSet";
            };

            return DungeonStatSet;
        })();

        dungeon.DungeonModifierValue = (function() {

            /**
             * Properties of a DungeonModifierValue.
             * @memberof arcade.dungeon
             * @interface IDungeonModifierValue
             * @property {number|null} [numberValue] DungeonModifierValue numberValue
             * @property {string|null} [stringValue] DungeonModifierValue stringValue
             * @property {boolean|null} [boolValue] DungeonModifierValue boolValue
             */

            /**
             * Constructs a new DungeonModifierValue.
             * @memberof arcade.dungeon
             * @classdesc Represents a DungeonModifierValue.
             * @implements IDungeonModifierValue
             * @constructor
             * @param {arcade.dungeon.IDungeonModifierValue=} [properties] Properties to set
             */
            function DungeonModifierValue(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * DungeonModifierValue numberValue.
             * @member {number|null|undefined} numberValue
             * @memberof arcade.dungeon.DungeonModifierValue
             * @instance
             */
            DungeonModifierValue.prototype.numberValue = null;

            /**
             * DungeonModifierValue stringValue.
             * @member {string|null|undefined} stringValue
             * @memberof arcade.dungeon.DungeonModifierValue
             * @instance
             */
            DungeonModifierValue.prototype.stringValue = null;

            /**
             * DungeonModifierValue boolValue.
             * @member {boolean|null|undefined} boolValue
             * @memberof arcade.dungeon.DungeonModifierValue
             * @instance
             */
            DungeonModifierValue.prototype.boolValue = null;

            // OneOf field names bound to virtual getters and setters
            let $oneOfFields;

            /**
             * DungeonModifierValue value.
             * @member {"numberValue"|"stringValue"|"boolValue"|undefined} value
             * @memberof arcade.dungeon.DungeonModifierValue
             * @instance
             */
            Object.defineProperty(DungeonModifierValue.prototype, "value", {
                get: $util.oneOfGetter($oneOfFields = ["numberValue", "stringValue", "boolValue"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            /**
             * Creates a new DungeonModifierValue instance using the specified properties.
             * @function create
             * @memberof arcade.dungeon.DungeonModifierValue
             * @static
             * @param {arcade.dungeon.IDungeonModifierValue=} [properties] Properties to set
             * @returns {arcade.dungeon.DungeonModifierValue} DungeonModifierValue instance
             */
            DungeonModifierValue.create = function create(properties) {
                return new DungeonModifierValue(properties);
            };

            /**
             * Encodes the specified DungeonModifierValue message. Does not implicitly {@link arcade.dungeon.DungeonModifierValue.verify|verify} messages.
             * @function encode
             * @memberof arcade.dungeon.DungeonModifierValue
             * @static
             * @param {arcade.dungeon.IDungeonModifierValue} message DungeonModifierValue message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonModifierValue.encode = function encode(message, writer, q) {
                if (!writer)
                    writer = $Writer.create();
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                if (message.numberValue != null && Object.hasOwnProperty.call(message, "numberValue"))
                    writer.uint32(/* id 1, wireType 1 =*/9).double(message.numberValue);
                if (message.stringValue != null && Object.hasOwnProperty.call(message, "stringValue"))
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.stringValue);
                if (message.boolValue != null && Object.hasOwnProperty.call(message, "boolValue"))
                    writer.uint32(/* id 3, wireType 0 =*/24).bool(message.boolValue);
                return writer;
            };

            /**
             * Encodes the specified DungeonModifierValue message, length delimited. Does not implicitly {@link arcade.dungeon.DungeonModifierValue.verify|verify} messages.
             * @function encodeDelimited
             * @memberof arcade.dungeon.DungeonModifierValue
             * @static
             * @param {arcade.dungeon.IDungeonModifierValue} message DungeonModifierValue message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonModifierValue.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
            };

            /**
             * Decodes a DungeonModifierValue message from the specified reader or buffer.
             * @function decode
             * @memberof arcade.dungeon.DungeonModifierValue
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {arcade.dungeon.DungeonModifierValue} DungeonModifierValue
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonModifierValue.decode = function decode(reader, length, error, long) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (long === undefined)
                    long = 0;
                if (long > $Reader.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let end, message;
                if (length === undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = new $root.arcade.dungeon.DungeonModifierValue();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.numberValue = reader.double();
                            break;
                        }
                    case 2: {
                            message.stringValue = reader.string();
                            break;
                        }
                    case 3: {
                            message.boolValue = reader.bool();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7, long);
                        break;
                    }
                }
                if (length !== undefined) {
                    if (reader.pos !== end)
                        throw RangeError("index out of range");
                    reader.len = length;
                }
                return message;
            };

            /**
             * Decodes a DungeonModifierValue message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof arcade.dungeon.DungeonModifierValue
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {arcade.dungeon.DungeonModifierValue} DungeonModifierValue
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonModifierValue.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a DungeonModifierValue message.
             * @function verify
             * @memberof arcade.dungeon.DungeonModifierValue
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            DungeonModifierValue.verify = function verify(message, long) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    return "maximum nesting depth exceeded";
                let properties = {};
                if (message.numberValue != null && Object.hasOwnProperty.call(message, "numberValue")) {
                    properties.value = 1;
                    if (typeof message.numberValue !== "number")
                        return "numberValue: number expected";
                }
                if (message.stringValue != null && Object.hasOwnProperty.call(message, "stringValue")) {
                    if (properties.value === 1)
                        return "value: multiple values";
                    properties.value = 1;
                    if (!$util.isString(message.stringValue))
                        return "stringValue: string expected";
                }
                if (message.boolValue != null && Object.hasOwnProperty.call(message, "boolValue")) {
                    if (properties.value === 1)
                        return "value: multiple values";
                    properties.value = 1;
                    if (typeof message.boolValue !== "boolean")
                        return "boolValue: boolean expected";
                }
                return null;
            };

            /**
             * Creates a DungeonModifierValue message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof arcade.dungeon.DungeonModifierValue
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {arcade.dungeon.DungeonModifierValue} DungeonModifierValue
             */
            DungeonModifierValue.fromObject = function fromObject(object, long) {
                if (object instanceof $root.arcade.dungeon.DungeonModifierValue)
                    return object;
                if (!$util.isObject(object))
                    throw TypeError(".arcade.dungeon.DungeonModifierValue: object expected");
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let message = new $root.arcade.dungeon.DungeonModifierValue();
                if (object.numberValue != null)
                    message.numberValue = Number(object.numberValue);
                if (object.stringValue != null)
                    message.stringValue = String(object.stringValue);
                if (object.boolValue != null)
                    message.boolValue = Boolean(object.boolValue);
                return message;
            };

            /**
             * Creates a plain object from a DungeonModifierValue message. Also converts values to other types if specified.
             * @function toObject
             * @memberof arcade.dungeon.DungeonModifierValue
             * @static
             * @param {arcade.dungeon.DungeonModifierValue} message DungeonModifierValue
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            DungeonModifierValue.toObject = function toObject(message, options, q) {
                if (!options)
                    options = {};
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                let object = {};
                if (message.numberValue != null && Object.hasOwnProperty.call(message, "numberValue")) {
                    object.numberValue = options.json && !isFinite(message.numberValue) ? String(message.numberValue) : message.numberValue;
                    if (options.oneofs)
                        object.value = "numberValue";
                }
                if (message.stringValue != null && Object.hasOwnProperty.call(message, "stringValue")) {
                    object.stringValue = message.stringValue;
                    if (options.oneofs)
                        object.value = "stringValue";
                }
                if (message.boolValue != null && Object.hasOwnProperty.call(message, "boolValue")) {
                    object.boolValue = message.boolValue;
                    if (options.oneofs)
                        object.value = "boolValue";
                }
                return object;
            };

            /**
             * Converts this DungeonModifierValue to JSON.
             * @function toJSON
             * @memberof arcade.dungeon.DungeonModifierValue
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            DungeonModifierValue.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for DungeonModifierValue
             * @function getTypeUrl
             * @memberof arcade.dungeon.DungeonModifierValue
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            DungeonModifierValue.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/arcade.dungeon.DungeonModifierValue";
            };

            return DungeonModifierValue;
        })();

        dungeon.DungeonModifierEntry = (function() {

            /**
             * Properties of a DungeonModifierEntry.
             * @memberof arcade.dungeon
             * @interface IDungeonModifierEntry
             * @property {string|null} [key] DungeonModifierEntry key
             * @property {arcade.dungeon.IDungeonModifierValue|null} [value] DungeonModifierEntry value
             */

            /**
             * Constructs a new DungeonModifierEntry.
             * @memberof arcade.dungeon
             * @classdesc Represents a DungeonModifierEntry.
             * @implements IDungeonModifierEntry
             * @constructor
             * @param {arcade.dungeon.IDungeonModifierEntry=} [properties] Properties to set
             */
            function DungeonModifierEntry(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * DungeonModifierEntry key.
             * @member {string} key
             * @memberof arcade.dungeon.DungeonModifierEntry
             * @instance
             */
            DungeonModifierEntry.prototype.key = "";

            /**
             * DungeonModifierEntry value.
             * @member {arcade.dungeon.IDungeonModifierValue|null|undefined} value
             * @memberof arcade.dungeon.DungeonModifierEntry
             * @instance
             */
            DungeonModifierEntry.prototype.value = null;

            /**
             * Creates a new DungeonModifierEntry instance using the specified properties.
             * @function create
             * @memberof arcade.dungeon.DungeonModifierEntry
             * @static
             * @param {arcade.dungeon.IDungeonModifierEntry=} [properties] Properties to set
             * @returns {arcade.dungeon.DungeonModifierEntry} DungeonModifierEntry instance
             */
            DungeonModifierEntry.create = function create(properties) {
                return new DungeonModifierEntry(properties);
            };

            /**
             * Encodes the specified DungeonModifierEntry message. Does not implicitly {@link arcade.dungeon.DungeonModifierEntry.verify|verify} messages.
             * @function encode
             * @memberof arcade.dungeon.DungeonModifierEntry
             * @static
             * @param {arcade.dungeon.IDungeonModifierEntry} message DungeonModifierEntry message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonModifierEntry.encode = function encode(message, writer, q) {
                if (!writer)
                    writer = $Writer.create();
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                if (message.key != null && Object.hasOwnProperty.call(message, "key"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.key);
                if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                    $root.arcade.dungeon.DungeonModifierValue.encode(message.value, writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
                return writer;
            };

            /**
             * Encodes the specified DungeonModifierEntry message, length delimited. Does not implicitly {@link arcade.dungeon.DungeonModifierEntry.verify|verify} messages.
             * @function encodeDelimited
             * @memberof arcade.dungeon.DungeonModifierEntry
             * @static
             * @param {arcade.dungeon.IDungeonModifierEntry} message DungeonModifierEntry message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonModifierEntry.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
            };

            /**
             * Decodes a DungeonModifierEntry message from the specified reader or buffer.
             * @function decode
             * @memberof arcade.dungeon.DungeonModifierEntry
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {arcade.dungeon.DungeonModifierEntry} DungeonModifierEntry
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonModifierEntry.decode = function decode(reader, length, error, long) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (long === undefined)
                    long = 0;
                if (long > $Reader.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let end, message;
                if (length === undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = new $root.arcade.dungeon.DungeonModifierEntry();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.key = reader.string();
                            break;
                        }
                    case 2: {
                            message.value = $root.arcade.dungeon.DungeonModifierValue.decode(reader, reader.uint32(), undefined, long + 1);
                            break;
                        }
                    default:
                        reader.skipType(tag & 7, long);
                        break;
                    }
                }
                if (length !== undefined) {
                    if (reader.pos !== end)
                        throw RangeError("index out of range");
                    reader.len = length;
                }
                return message;
            };

            /**
             * Decodes a DungeonModifierEntry message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof arcade.dungeon.DungeonModifierEntry
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {arcade.dungeon.DungeonModifierEntry} DungeonModifierEntry
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonModifierEntry.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a DungeonModifierEntry message.
             * @function verify
             * @memberof arcade.dungeon.DungeonModifierEntry
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            DungeonModifierEntry.verify = function verify(message, long) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    return "maximum nesting depth exceeded";
                if (message.key != null && Object.hasOwnProperty.call(message, "key"))
                    if (!$util.isString(message.key))
                        return "key: string expected";
                if (message.value != null && Object.hasOwnProperty.call(message, "value")) {
                    let error = $root.arcade.dungeon.DungeonModifierValue.verify(message.value, long + 1);
                    if (error)
                        return "value." + error;
                }
                return null;
            };

            /**
             * Creates a DungeonModifierEntry message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof arcade.dungeon.DungeonModifierEntry
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {arcade.dungeon.DungeonModifierEntry} DungeonModifierEntry
             */
            DungeonModifierEntry.fromObject = function fromObject(object, long) {
                if (object instanceof $root.arcade.dungeon.DungeonModifierEntry)
                    return object;
                if (!$util.isObject(object))
                    throw TypeError(".arcade.dungeon.DungeonModifierEntry: object expected");
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let message = new $root.arcade.dungeon.DungeonModifierEntry();
                if (object.key != null)
                    message.key = String(object.key);
                if (object.value != null) {
                    if (!$util.isObject(object.value))
                        throw TypeError(".arcade.dungeon.DungeonModifierEntry.value: object expected");
                    message.value = $root.arcade.dungeon.DungeonModifierValue.fromObject(object.value, long + 1);
                }
                return message;
            };

            /**
             * Creates a plain object from a DungeonModifierEntry message. Also converts values to other types if specified.
             * @function toObject
             * @memberof arcade.dungeon.DungeonModifierEntry
             * @static
             * @param {arcade.dungeon.DungeonModifierEntry} message DungeonModifierEntry
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            DungeonModifierEntry.toObject = function toObject(message, options, q) {
                if (!options)
                    options = {};
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    object.key = "";
                    object.value = null;
                }
                if (message.key != null && Object.hasOwnProperty.call(message, "key"))
                    object.key = message.key;
                if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                    object.value = $root.arcade.dungeon.DungeonModifierValue.toObject(message.value, options, q + 1);
                return object;
            };

            /**
             * Converts this DungeonModifierEntry to JSON.
             * @function toJSON
             * @memberof arcade.dungeon.DungeonModifierEntry
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            DungeonModifierEntry.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for DungeonModifierEntry
             * @function getTypeUrl
             * @memberof arcade.dungeon.DungeonModifierEntry
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            DungeonModifierEntry.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/arcade.dungeon.DungeonModifierEntry";
            };

            return DungeonModifierEntry;
        })();

        dungeon.DungeonModifierLayer = (function() {

            /**
             * Properties of a DungeonModifierLayer.
             * @memberof arcade.dungeon
             * @interface IDungeonModifierLayer
             * @property {string|null} [name] DungeonModifierLayer name
             * @property {Array.<arcade.dungeon.IDungeonModifierEntry>|null} [values] DungeonModifierLayer values
             */

            /**
             * Constructs a new DungeonModifierLayer.
             * @memberof arcade.dungeon
             * @classdesc Represents a DungeonModifierLayer.
             * @implements IDungeonModifierLayer
             * @constructor
             * @param {arcade.dungeon.IDungeonModifierLayer=} [properties] Properties to set
             */
            function DungeonModifierLayer(properties) {
                this.values = [];
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * DungeonModifierLayer name.
             * @member {string} name
             * @memberof arcade.dungeon.DungeonModifierLayer
             * @instance
             */
            DungeonModifierLayer.prototype.name = "";

            /**
             * DungeonModifierLayer values.
             * @member {Array.<arcade.dungeon.IDungeonModifierEntry>} values
             * @memberof arcade.dungeon.DungeonModifierLayer
             * @instance
             */
            DungeonModifierLayer.prototype.values = $util.emptyArray;

            /**
             * Creates a new DungeonModifierLayer instance using the specified properties.
             * @function create
             * @memberof arcade.dungeon.DungeonModifierLayer
             * @static
             * @param {arcade.dungeon.IDungeonModifierLayer=} [properties] Properties to set
             * @returns {arcade.dungeon.DungeonModifierLayer} DungeonModifierLayer instance
             */
            DungeonModifierLayer.create = function create(properties) {
                return new DungeonModifierLayer(properties);
            };

            /**
             * Encodes the specified DungeonModifierLayer message. Does not implicitly {@link arcade.dungeon.DungeonModifierLayer.verify|verify} messages.
             * @function encode
             * @memberof arcade.dungeon.DungeonModifierLayer
             * @static
             * @param {arcade.dungeon.IDungeonModifierLayer} message DungeonModifierLayer message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonModifierLayer.encode = function encode(message, writer, q) {
                if (!writer)
                    writer = $Writer.create();
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.name);
                if (message.values != null && message.values.length)
                    for (let i = 0; i < message.values.length; ++i)
                        $root.arcade.dungeon.DungeonModifierEntry.encode(message.values[i], writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
                return writer;
            };

            /**
             * Encodes the specified DungeonModifierLayer message, length delimited. Does not implicitly {@link arcade.dungeon.DungeonModifierLayer.verify|verify} messages.
             * @function encodeDelimited
             * @memberof arcade.dungeon.DungeonModifierLayer
             * @static
             * @param {arcade.dungeon.IDungeonModifierLayer} message DungeonModifierLayer message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonModifierLayer.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
            };

            /**
             * Decodes a DungeonModifierLayer message from the specified reader or buffer.
             * @function decode
             * @memberof arcade.dungeon.DungeonModifierLayer
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {arcade.dungeon.DungeonModifierLayer} DungeonModifierLayer
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonModifierLayer.decode = function decode(reader, length, error, long) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (long === undefined)
                    long = 0;
                if (long > $Reader.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let end, message;
                if (length === undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = new $root.arcade.dungeon.DungeonModifierLayer();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.name = reader.string();
                            break;
                        }
                    case 2: {
                            if (!(message.values && message.values.length))
                                message.values = [];
                            message.values.push($root.arcade.dungeon.DungeonModifierEntry.decode(reader, reader.uint32(), undefined, long + 1));
                            break;
                        }
                    default:
                        reader.skipType(tag & 7, long);
                        break;
                    }
                }
                if (length !== undefined) {
                    if (reader.pos !== end)
                        throw RangeError("index out of range");
                    reader.len = length;
                }
                return message;
            };

            /**
             * Decodes a DungeonModifierLayer message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof arcade.dungeon.DungeonModifierLayer
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {arcade.dungeon.DungeonModifierLayer} DungeonModifierLayer
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonModifierLayer.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a DungeonModifierLayer message.
             * @function verify
             * @memberof arcade.dungeon.DungeonModifierLayer
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            DungeonModifierLayer.verify = function verify(message, long) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    return "maximum nesting depth exceeded";
                if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                    if (!$util.isString(message.name))
                        return "name: string expected";
                if (message.values != null && Object.hasOwnProperty.call(message, "values")) {
                    if (!Array.isArray(message.values))
                        return "values: array expected";
                    for (let i = 0; i < message.values.length; ++i) {
                        let error = $root.arcade.dungeon.DungeonModifierEntry.verify(message.values[i], long + 1);
                        if (error)
                            return "values." + error;
                    }
                }
                return null;
            };

            /**
             * Creates a DungeonModifierLayer message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof arcade.dungeon.DungeonModifierLayer
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {arcade.dungeon.DungeonModifierLayer} DungeonModifierLayer
             */
            DungeonModifierLayer.fromObject = function fromObject(object, long) {
                if (object instanceof $root.arcade.dungeon.DungeonModifierLayer)
                    return object;
                if (!$util.isObject(object))
                    throw TypeError(".arcade.dungeon.DungeonModifierLayer: object expected");
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let message = new $root.arcade.dungeon.DungeonModifierLayer();
                if (object.name != null)
                    message.name = String(object.name);
                if (object.values) {
                    if (!Array.isArray(object.values))
                        throw TypeError(".arcade.dungeon.DungeonModifierLayer.values: array expected");
                    message.values = [];
                    for (let i = 0; i < object.values.length; ++i) {
                        if (!$util.isObject(object.values[i]))
                            throw TypeError(".arcade.dungeon.DungeonModifierLayer.values: object expected");
                        message.values[i] = $root.arcade.dungeon.DungeonModifierEntry.fromObject(object.values[i], long + 1);
                    }
                }
                return message;
            };

            /**
             * Creates a plain object from a DungeonModifierLayer message. Also converts values to other types if specified.
             * @function toObject
             * @memberof arcade.dungeon.DungeonModifierLayer
             * @static
             * @param {arcade.dungeon.DungeonModifierLayer} message DungeonModifierLayer
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            DungeonModifierLayer.toObject = function toObject(message, options, q) {
                if (!options)
                    options = {};
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                let object = {};
                if (options.arrays || options.defaults)
                    object.values = [];
                if (options.defaults)
                    object.name = "";
                if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                    object.name = message.name;
                if (message.values && message.values.length) {
                    object.values = [];
                    for (let j = 0; j < message.values.length; ++j)
                        object.values[j] = $root.arcade.dungeon.DungeonModifierEntry.toObject(message.values[j], options, q + 1);
                }
                return object;
            };

            /**
             * Converts this DungeonModifierLayer to JSON.
             * @function toJSON
             * @memberof arcade.dungeon.DungeonModifierLayer
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            DungeonModifierLayer.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for DungeonModifierLayer
             * @function getTypeUrl
             * @memberof arcade.dungeon.DungeonModifierLayer
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            DungeonModifierLayer.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/arcade.dungeon.DungeonModifierLayer";
            };

            return DungeonModifierLayer;
        })();

        dungeon.DungeonModifierSet = (function() {

            /**
             * Properties of a DungeonModifierSet.
             * @memberof arcade.dungeon
             * @interface IDungeonModifierSet
             * @property {Array.<arcade.dungeon.IDungeonModifierLayer>|null} [layers] DungeonModifierSet layers
             */

            /**
             * Constructs a new DungeonModifierSet.
             * @memberof arcade.dungeon
             * @classdesc Represents a DungeonModifierSet.
             * @implements IDungeonModifierSet
             * @constructor
             * @param {arcade.dungeon.IDungeonModifierSet=} [properties] Properties to set
             */
            function DungeonModifierSet(properties) {
                this.layers = [];
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * DungeonModifierSet layers.
             * @member {Array.<arcade.dungeon.IDungeonModifierLayer>} layers
             * @memberof arcade.dungeon.DungeonModifierSet
             * @instance
             */
            DungeonModifierSet.prototype.layers = $util.emptyArray;

            /**
             * Creates a new DungeonModifierSet instance using the specified properties.
             * @function create
             * @memberof arcade.dungeon.DungeonModifierSet
             * @static
             * @param {arcade.dungeon.IDungeonModifierSet=} [properties] Properties to set
             * @returns {arcade.dungeon.DungeonModifierSet} DungeonModifierSet instance
             */
            DungeonModifierSet.create = function create(properties) {
                return new DungeonModifierSet(properties);
            };

            /**
             * Encodes the specified DungeonModifierSet message. Does not implicitly {@link arcade.dungeon.DungeonModifierSet.verify|verify} messages.
             * @function encode
             * @memberof arcade.dungeon.DungeonModifierSet
             * @static
             * @param {arcade.dungeon.IDungeonModifierSet} message DungeonModifierSet message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonModifierSet.encode = function encode(message, writer, q) {
                if (!writer)
                    writer = $Writer.create();
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                if (message.layers != null && message.layers.length)
                    for (let i = 0; i < message.layers.length; ++i)
                        $root.arcade.dungeon.DungeonModifierLayer.encode(message.layers[i], writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
                return writer;
            };

            /**
             * Encodes the specified DungeonModifierSet message, length delimited. Does not implicitly {@link arcade.dungeon.DungeonModifierSet.verify|verify} messages.
             * @function encodeDelimited
             * @memberof arcade.dungeon.DungeonModifierSet
             * @static
             * @param {arcade.dungeon.IDungeonModifierSet} message DungeonModifierSet message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonModifierSet.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
            };

            /**
             * Decodes a DungeonModifierSet message from the specified reader or buffer.
             * @function decode
             * @memberof arcade.dungeon.DungeonModifierSet
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {arcade.dungeon.DungeonModifierSet} DungeonModifierSet
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonModifierSet.decode = function decode(reader, length, error, long) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (long === undefined)
                    long = 0;
                if (long > $Reader.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let end, message;
                if (length === undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = new $root.arcade.dungeon.DungeonModifierSet();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            if (!(message.layers && message.layers.length))
                                message.layers = [];
                            message.layers.push($root.arcade.dungeon.DungeonModifierLayer.decode(reader, reader.uint32(), undefined, long + 1));
                            break;
                        }
                    default:
                        reader.skipType(tag & 7, long);
                        break;
                    }
                }
                if (length !== undefined) {
                    if (reader.pos !== end)
                        throw RangeError("index out of range");
                    reader.len = length;
                }
                return message;
            };

            /**
             * Decodes a DungeonModifierSet message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof arcade.dungeon.DungeonModifierSet
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {arcade.dungeon.DungeonModifierSet} DungeonModifierSet
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonModifierSet.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a DungeonModifierSet message.
             * @function verify
             * @memberof arcade.dungeon.DungeonModifierSet
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            DungeonModifierSet.verify = function verify(message, long) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    return "maximum nesting depth exceeded";
                if (message.layers != null && Object.hasOwnProperty.call(message, "layers")) {
                    if (!Array.isArray(message.layers))
                        return "layers: array expected";
                    for (let i = 0; i < message.layers.length; ++i) {
                        let error = $root.arcade.dungeon.DungeonModifierLayer.verify(message.layers[i], long + 1);
                        if (error)
                            return "layers." + error;
                    }
                }
                return null;
            };

            /**
             * Creates a DungeonModifierSet message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof arcade.dungeon.DungeonModifierSet
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {arcade.dungeon.DungeonModifierSet} DungeonModifierSet
             */
            DungeonModifierSet.fromObject = function fromObject(object, long) {
                if (object instanceof $root.arcade.dungeon.DungeonModifierSet)
                    return object;
                if (!$util.isObject(object))
                    throw TypeError(".arcade.dungeon.DungeonModifierSet: object expected");
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let message = new $root.arcade.dungeon.DungeonModifierSet();
                if (object.layers) {
                    if (!Array.isArray(object.layers))
                        throw TypeError(".arcade.dungeon.DungeonModifierSet.layers: array expected");
                    message.layers = [];
                    for (let i = 0; i < object.layers.length; ++i) {
                        if (!$util.isObject(object.layers[i]))
                            throw TypeError(".arcade.dungeon.DungeonModifierSet.layers: object expected");
                        message.layers[i] = $root.arcade.dungeon.DungeonModifierLayer.fromObject(object.layers[i], long + 1);
                    }
                }
                return message;
            };

            /**
             * Creates a plain object from a DungeonModifierSet message. Also converts values to other types if specified.
             * @function toObject
             * @memberof arcade.dungeon.DungeonModifierSet
             * @static
             * @param {arcade.dungeon.DungeonModifierSet} message DungeonModifierSet
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            DungeonModifierSet.toObject = function toObject(message, options, q) {
                if (!options)
                    options = {};
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                let object = {};
                if (options.arrays || options.defaults)
                    object.layers = [];
                if (message.layers && message.layers.length) {
                    object.layers = [];
                    for (let j = 0; j < message.layers.length; ++j)
                        object.layers[j] = $root.arcade.dungeon.DungeonModifierLayer.toObject(message.layers[j], options, q + 1);
                }
                return object;
            };

            /**
             * Converts this DungeonModifierSet to JSON.
             * @function toJSON
             * @memberof arcade.dungeon.DungeonModifierSet
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            DungeonModifierSet.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for DungeonModifierSet
             * @function getTypeUrl
             * @memberof arcade.dungeon.DungeonModifierSet
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            DungeonModifierSet.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/arcade.dungeon.DungeonModifierSet";
            };

            return DungeonModifierSet;
        })();

        dungeon.DungeonWeaponAffix = (function() {

            /**
             * Properties of a DungeonWeaponAffix.
             * @memberof arcade.dungeon
             * @interface IDungeonWeaponAffix
             * @property {string|null} [id] DungeonWeaponAffix id
             * @property {number|null} [value] DungeonWeaponAffix value
             * @property {number|null} [tier] DungeonWeaponAffix tier
             */

            /**
             * Constructs a new DungeonWeaponAffix.
             * @memberof arcade.dungeon
             * @classdesc Represents a DungeonWeaponAffix.
             * @implements IDungeonWeaponAffix
             * @constructor
             * @param {arcade.dungeon.IDungeonWeaponAffix=} [properties] Properties to set
             */
            function DungeonWeaponAffix(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * DungeonWeaponAffix id.
             * @member {string} id
             * @memberof arcade.dungeon.DungeonWeaponAffix
             * @instance
             */
            DungeonWeaponAffix.prototype.id = "";

            /**
             * DungeonWeaponAffix value.
             * @member {number|null|undefined} value
             * @memberof arcade.dungeon.DungeonWeaponAffix
             * @instance
             */
            DungeonWeaponAffix.prototype.value = null;

            /**
             * DungeonWeaponAffix tier.
             * @member {number|null|undefined} tier
             * @memberof arcade.dungeon.DungeonWeaponAffix
             * @instance
             */
            DungeonWeaponAffix.prototype.tier = null;

            // OneOf field names bound to virtual getters and setters
            let $oneOfFields;

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonWeaponAffix.prototype, "_value", {
                get: $util.oneOfGetter($oneOfFields = ["value"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonWeaponAffix.prototype, "_tier", {
                get: $util.oneOfGetter($oneOfFields = ["tier"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            /**
             * Creates a new DungeonWeaponAffix instance using the specified properties.
             * @function create
             * @memberof arcade.dungeon.DungeonWeaponAffix
             * @static
             * @param {arcade.dungeon.IDungeonWeaponAffix=} [properties] Properties to set
             * @returns {arcade.dungeon.DungeonWeaponAffix} DungeonWeaponAffix instance
             */
            DungeonWeaponAffix.create = function create(properties) {
                return new DungeonWeaponAffix(properties);
            };

            /**
             * Encodes the specified DungeonWeaponAffix message. Does not implicitly {@link arcade.dungeon.DungeonWeaponAffix.verify|verify} messages.
             * @function encode
             * @memberof arcade.dungeon.DungeonWeaponAffix
             * @static
             * @param {arcade.dungeon.IDungeonWeaponAffix} message DungeonWeaponAffix message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonWeaponAffix.encode = function encode(message, writer, q) {
                if (!writer)
                    writer = $Writer.create();
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
                if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                    writer.uint32(/* id 2, wireType 1 =*/17).double(message.value);
                if (message.tier != null && Object.hasOwnProperty.call(message, "tier"))
                    writer.uint32(/* id 3, wireType 0 =*/24).int32(message.tier);
                return writer;
            };

            /**
             * Encodes the specified DungeonWeaponAffix message, length delimited. Does not implicitly {@link arcade.dungeon.DungeonWeaponAffix.verify|verify} messages.
             * @function encodeDelimited
             * @memberof arcade.dungeon.DungeonWeaponAffix
             * @static
             * @param {arcade.dungeon.IDungeonWeaponAffix} message DungeonWeaponAffix message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonWeaponAffix.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
            };

            /**
             * Decodes a DungeonWeaponAffix message from the specified reader or buffer.
             * @function decode
             * @memberof arcade.dungeon.DungeonWeaponAffix
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {arcade.dungeon.DungeonWeaponAffix} DungeonWeaponAffix
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonWeaponAffix.decode = function decode(reader, length, error, long) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (long === undefined)
                    long = 0;
                if (long > $Reader.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let end, message;
                if (length === undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = new $root.arcade.dungeon.DungeonWeaponAffix();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.id = reader.string();
                            break;
                        }
                    case 2: {
                            message.value = reader.double();
                            break;
                        }
                    case 3: {
                            message.tier = reader.int32();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7, long);
                        break;
                    }
                }
                if (length !== undefined) {
                    if (reader.pos !== end)
                        throw RangeError("index out of range");
                    reader.len = length;
                }
                return message;
            };

            /**
             * Decodes a DungeonWeaponAffix message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof arcade.dungeon.DungeonWeaponAffix
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {arcade.dungeon.DungeonWeaponAffix} DungeonWeaponAffix
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonWeaponAffix.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a DungeonWeaponAffix message.
             * @function verify
             * @memberof arcade.dungeon.DungeonWeaponAffix
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            DungeonWeaponAffix.verify = function verify(message, long) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    return "maximum nesting depth exceeded";
                let properties = {};
                if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                    if (!$util.isString(message.id))
                        return "id: string expected";
                if (message.value != null && Object.hasOwnProperty.call(message, "value")) {
                    properties._value = 1;
                    if (typeof message.value !== "number")
                        return "value: number expected";
                }
                if (message.tier != null && Object.hasOwnProperty.call(message, "tier")) {
                    properties._tier = 1;
                    if (!$util.isInteger(message.tier))
                        return "tier: integer expected";
                }
                return null;
            };

            /**
             * Creates a DungeonWeaponAffix message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof arcade.dungeon.DungeonWeaponAffix
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {arcade.dungeon.DungeonWeaponAffix} DungeonWeaponAffix
             */
            DungeonWeaponAffix.fromObject = function fromObject(object, long) {
                if (object instanceof $root.arcade.dungeon.DungeonWeaponAffix)
                    return object;
                if (!$util.isObject(object))
                    throw TypeError(".arcade.dungeon.DungeonWeaponAffix: object expected");
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let message = new $root.arcade.dungeon.DungeonWeaponAffix();
                if (object.id != null)
                    message.id = String(object.id);
                if (object.value != null)
                    message.value = Number(object.value);
                if (object.tier != null)
                    message.tier = object.tier | 0;
                return message;
            };

            /**
             * Creates a plain object from a DungeonWeaponAffix message. Also converts values to other types if specified.
             * @function toObject
             * @memberof arcade.dungeon.DungeonWeaponAffix
             * @static
             * @param {arcade.dungeon.DungeonWeaponAffix} message DungeonWeaponAffix
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            DungeonWeaponAffix.toObject = function toObject(message, options, q) {
                if (!options)
                    options = {};
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                let object = {};
                if (options.defaults)
                    object.id = "";
                if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                    object.id = message.id;
                if (message.value != null && Object.hasOwnProperty.call(message, "value")) {
                    object.value = options.json && !isFinite(message.value) ? String(message.value) : message.value;
                    if (options.oneofs)
                        object._value = "value";
                }
                if (message.tier != null && Object.hasOwnProperty.call(message, "tier")) {
                    object.tier = message.tier;
                    if (options.oneofs)
                        object._tier = "tier";
                }
                return object;
            };

            /**
             * Converts this DungeonWeaponAffix to JSON.
             * @function toJSON
             * @memberof arcade.dungeon.DungeonWeaponAffix
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            DungeonWeaponAffix.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for DungeonWeaponAffix
             * @function getTypeUrl
             * @memberof arcade.dungeon.DungeonWeaponAffix
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            DungeonWeaponAffix.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/arcade.dungeon.DungeonWeaponAffix";
            };

            return DungeonWeaponAffix;
        })();

        dungeon.DungeonWeapon = (function() {

            /**
             * Properties of a DungeonWeapon.
             * @memberof arcade.dungeon
             * @interface IDungeonWeapon
             * @property {string|null} [id] DungeonWeapon id
             * @property {string|null} [name] DungeonWeapon name
             * @property {string|null} [type] DungeonWeapon type
             * @property {string|null} [archetype] DungeonWeapon archetype
             * @property {string|null} [rarity] DungeonWeapon rarity
             * @property {number|null} [damage] DungeonWeapon damage
             * @property {string|null} [vfxTheme] DungeonWeapon vfxTheme
             * @property {number|null} [vfxVariant] DungeonWeapon vfxVariant
             * @property {Array.<arcade.dungeon.IDungeonWeaponAffix>|null} [affixes] DungeonWeapon affixes
             * @property {number|null} [legendaryLevel] DungeonWeapon legendaryLevel
             * @property {Array.<string>|null} [signatureAffixes] DungeonWeapon signatureAffixes
             * @property {number|null} [baseDamage] DungeonWeapon baseDamage
             * @property {boolean|null} [bossOnly] DungeonWeapon bossOnly
             * @property {number|null} [minFloor] DungeonWeapon minFloor
             * @property {number|null} [legendaryBaseDamage] DungeonWeapon legendaryBaseDamage
             * @property {Array.<arcade.dungeon.IDungeonWeaponAffix>|null} [legendaryBaseAffixes] DungeonWeapon legendaryBaseAffixes
             * @property {string|null} [signature] DungeonWeapon signature
             * @property {number|null} [swordNumber] DungeonWeapon swordNumber
             */

            /**
             * Constructs a new DungeonWeapon.
             * @memberof arcade.dungeon
             * @classdesc Represents a DungeonWeapon.
             * @implements IDungeonWeapon
             * @constructor
             * @param {arcade.dungeon.IDungeonWeapon=} [properties] Properties to set
             */
            function DungeonWeapon(properties) {
                this.affixes = [];
                this.signatureAffixes = [];
                this.legendaryBaseAffixes = [];
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * DungeonWeapon id.
             * @member {string} id
             * @memberof arcade.dungeon.DungeonWeapon
             * @instance
             */
            DungeonWeapon.prototype.id = "";

            /**
             * DungeonWeapon name.
             * @member {string} name
             * @memberof arcade.dungeon.DungeonWeapon
             * @instance
             */
            DungeonWeapon.prototype.name = "";

            /**
             * DungeonWeapon type.
             * @member {string} type
             * @memberof arcade.dungeon.DungeonWeapon
             * @instance
             */
            DungeonWeapon.prototype.type = "";

            /**
             * DungeonWeapon archetype.
             * @member {string} archetype
             * @memberof arcade.dungeon.DungeonWeapon
             * @instance
             */
            DungeonWeapon.prototype.archetype = "";

            /**
             * DungeonWeapon rarity.
             * @member {string} rarity
             * @memberof arcade.dungeon.DungeonWeapon
             * @instance
             */
            DungeonWeapon.prototype.rarity = "";

            /**
             * DungeonWeapon damage.
             * @member {number|null|undefined} damage
             * @memberof arcade.dungeon.DungeonWeapon
             * @instance
             */
            DungeonWeapon.prototype.damage = null;

            /**
             * DungeonWeapon vfxTheme.
             * @member {string} vfxTheme
             * @memberof arcade.dungeon.DungeonWeapon
             * @instance
             */
            DungeonWeapon.prototype.vfxTheme = "";

            /**
             * DungeonWeapon vfxVariant.
             * @member {number|null|undefined} vfxVariant
             * @memberof arcade.dungeon.DungeonWeapon
             * @instance
             */
            DungeonWeapon.prototype.vfxVariant = null;

            /**
             * DungeonWeapon affixes.
             * @member {Array.<arcade.dungeon.IDungeonWeaponAffix>} affixes
             * @memberof arcade.dungeon.DungeonWeapon
             * @instance
             */
            DungeonWeapon.prototype.affixes = $util.emptyArray;

            /**
             * DungeonWeapon legendaryLevel.
             * @member {number|null|undefined} legendaryLevel
             * @memberof arcade.dungeon.DungeonWeapon
             * @instance
             */
            DungeonWeapon.prototype.legendaryLevel = null;

            /**
             * DungeonWeapon signatureAffixes.
             * @member {Array.<string>} signatureAffixes
             * @memberof arcade.dungeon.DungeonWeapon
             * @instance
             */
            DungeonWeapon.prototype.signatureAffixes = $util.emptyArray;

            /**
             * DungeonWeapon baseDamage.
             * @member {number|null|undefined} baseDamage
             * @memberof arcade.dungeon.DungeonWeapon
             * @instance
             */
            DungeonWeapon.prototype.baseDamage = null;

            /**
             * DungeonWeapon bossOnly.
             * @member {boolean|null|undefined} bossOnly
             * @memberof arcade.dungeon.DungeonWeapon
             * @instance
             */
            DungeonWeapon.prototype.bossOnly = null;

            /**
             * DungeonWeapon minFloor.
             * @member {number|null|undefined} minFloor
             * @memberof arcade.dungeon.DungeonWeapon
             * @instance
             */
            DungeonWeapon.prototype.minFloor = null;

            /**
             * DungeonWeapon legendaryBaseDamage.
             * @member {number|null|undefined} legendaryBaseDamage
             * @memberof arcade.dungeon.DungeonWeapon
             * @instance
             */
            DungeonWeapon.prototype.legendaryBaseDamage = null;

            /**
             * DungeonWeapon legendaryBaseAffixes.
             * @member {Array.<arcade.dungeon.IDungeonWeaponAffix>} legendaryBaseAffixes
             * @memberof arcade.dungeon.DungeonWeapon
             * @instance
             */
            DungeonWeapon.prototype.legendaryBaseAffixes = $util.emptyArray;

            /**
             * DungeonWeapon signature.
             * @member {string} signature
             * @memberof arcade.dungeon.DungeonWeapon
             * @instance
             */
            DungeonWeapon.prototype.signature = "";

            /**
             * DungeonWeapon swordNumber.
             * @member {number|null|undefined} swordNumber
             * @memberof arcade.dungeon.DungeonWeapon
             * @instance
             */
            DungeonWeapon.prototype.swordNumber = null;

            // OneOf field names bound to virtual getters and setters
            let $oneOfFields;

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonWeapon.prototype, "_damage", {
                get: $util.oneOfGetter($oneOfFields = ["damage"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonWeapon.prototype, "_vfxVariant", {
                get: $util.oneOfGetter($oneOfFields = ["vfxVariant"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonWeapon.prototype, "_legendaryLevel", {
                get: $util.oneOfGetter($oneOfFields = ["legendaryLevel"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonWeapon.prototype, "_baseDamage", {
                get: $util.oneOfGetter($oneOfFields = ["baseDamage"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonWeapon.prototype, "_bossOnly", {
                get: $util.oneOfGetter($oneOfFields = ["bossOnly"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonWeapon.prototype, "_minFloor", {
                get: $util.oneOfGetter($oneOfFields = ["minFloor"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonWeapon.prototype, "_legendaryBaseDamage", {
                get: $util.oneOfGetter($oneOfFields = ["legendaryBaseDamage"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonWeapon.prototype, "_swordNumber", {
                get: $util.oneOfGetter($oneOfFields = ["swordNumber"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            /**
             * Creates a new DungeonWeapon instance using the specified properties.
             * @function create
             * @memberof arcade.dungeon.DungeonWeapon
             * @static
             * @param {arcade.dungeon.IDungeonWeapon=} [properties] Properties to set
             * @returns {arcade.dungeon.DungeonWeapon} DungeonWeapon instance
             */
            DungeonWeapon.create = function create(properties) {
                return new DungeonWeapon(properties);
            };

            /**
             * Encodes the specified DungeonWeapon message. Does not implicitly {@link arcade.dungeon.DungeonWeapon.verify|verify} messages.
             * @function encode
             * @memberof arcade.dungeon.DungeonWeapon
             * @static
             * @param {arcade.dungeon.IDungeonWeapon} message DungeonWeapon message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonWeapon.encode = function encode(message, writer, q) {
                if (!writer)
                    writer = $Writer.create();
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
                if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.name);
                if (message.type != null && Object.hasOwnProperty.call(message, "type"))
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.type);
                if (message.archetype != null && Object.hasOwnProperty.call(message, "archetype"))
                    writer.uint32(/* id 4, wireType 2 =*/34).string(message.archetype);
                if (message.rarity != null && Object.hasOwnProperty.call(message, "rarity"))
                    writer.uint32(/* id 5, wireType 2 =*/42).string(message.rarity);
                if (message.damage != null && Object.hasOwnProperty.call(message, "damage"))
                    writer.uint32(/* id 6, wireType 1 =*/49).double(message.damage);
                if (message.vfxTheme != null && Object.hasOwnProperty.call(message, "vfxTheme"))
                    writer.uint32(/* id 7, wireType 2 =*/58).string(message.vfxTheme);
                if (message.vfxVariant != null && Object.hasOwnProperty.call(message, "vfxVariant"))
                    writer.uint32(/* id 8, wireType 0 =*/64).int32(message.vfxVariant);
                if (message.affixes != null && message.affixes.length)
                    for (let i = 0; i < message.affixes.length; ++i)
                        $root.arcade.dungeon.DungeonWeaponAffix.encode(message.affixes[i], writer.uint32(/* id 9, wireType 2 =*/74).fork(), q + 1).ldelim();
                if (message.legendaryLevel != null && Object.hasOwnProperty.call(message, "legendaryLevel"))
                    writer.uint32(/* id 10, wireType 0 =*/80).int32(message.legendaryLevel);
                if (message.signatureAffixes != null && message.signatureAffixes.length)
                    for (let i = 0; i < message.signatureAffixes.length; ++i)
                        writer.uint32(/* id 11, wireType 2 =*/90).string(message.signatureAffixes[i]);
                if (message.baseDamage != null && Object.hasOwnProperty.call(message, "baseDamage"))
                    writer.uint32(/* id 12, wireType 1 =*/97).double(message.baseDamage);
                if (message.bossOnly != null && Object.hasOwnProperty.call(message, "bossOnly"))
                    writer.uint32(/* id 13, wireType 0 =*/104).bool(message.bossOnly);
                if (message.minFloor != null && Object.hasOwnProperty.call(message, "minFloor"))
                    writer.uint32(/* id 14, wireType 0 =*/112).int32(message.minFloor);
                if (message.legendaryBaseDamage != null && Object.hasOwnProperty.call(message, "legendaryBaseDamage"))
                    writer.uint32(/* id 15, wireType 1 =*/121).double(message.legendaryBaseDamage);
                if (message.legendaryBaseAffixes != null && message.legendaryBaseAffixes.length)
                    for (let i = 0; i < message.legendaryBaseAffixes.length; ++i)
                        $root.arcade.dungeon.DungeonWeaponAffix.encode(message.legendaryBaseAffixes[i], writer.uint32(/* id 16, wireType 2 =*/130).fork(), q + 1).ldelim();
                if (message.signature != null && Object.hasOwnProperty.call(message, "signature"))
                    writer.uint32(/* id 17, wireType 2 =*/138).string(message.signature);
                if (message.swordNumber != null && Object.hasOwnProperty.call(message, "swordNumber"))
                    writer.uint32(/* id 18, wireType 0 =*/144).int32(message.swordNumber);
                return writer;
            };

            /**
             * Encodes the specified DungeonWeapon message, length delimited. Does not implicitly {@link arcade.dungeon.DungeonWeapon.verify|verify} messages.
             * @function encodeDelimited
             * @memberof arcade.dungeon.DungeonWeapon
             * @static
             * @param {arcade.dungeon.IDungeonWeapon} message DungeonWeapon message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonWeapon.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
            };

            /**
             * Decodes a DungeonWeapon message from the specified reader or buffer.
             * @function decode
             * @memberof arcade.dungeon.DungeonWeapon
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {arcade.dungeon.DungeonWeapon} DungeonWeapon
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonWeapon.decode = function decode(reader, length, error, long) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (long === undefined)
                    long = 0;
                if (long > $Reader.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let end, message;
                if (length === undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = new $root.arcade.dungeon.DungeonWeapon();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.id = reader.string();
                            break;
                        }
                    case 2: {
                            message.name = reader.string();
                            break;
                        }
                    case 3: {
                            message.type = reader.string();
                            break;
                        }
                    case 4: {
                            message.archetype = reader.string();
                            break;
                        }
                    case 5: {
                            message.rarity = reader.string();
                            break;
                        }
                    case 6: {
                            message.damage = reader.double();
                            break;
                        }
                    case 7: {
                            message.vfxTheme = reader.string();
                            break;
                        }
                    case 8: {
                            message.vfxVariant = reader.int32();
                            break;
                        }
                    case 9: {
                            if (!(message.affixes && message.affixes.length))
                                message.affixes = [];
                            message.affixes.push($root.arcade.dungeon.DungeonWeaponAffix.decode(reader, reader.uint32(), undefined, long + 1));
                            break;
                        }
                    case 10: {
                            message.legendaryLevel = reader.int32();
                            break;
                        }
                    case 11: {
                            if (!(message.signatureAffixes && message.signatureAffixes.length))
                                message.signatureAffixes = [];
                            message.signatureAffixes.push(reader.string());
                            break;
                        }
                    case 12: {
                            message.baseDamage = reader.double();
                            break;
                        }
                    case 13: {
                            message.bossOnly = reader.bool();
                            break;
                        }
                    case 14: {
                            message.minFloor = reader.int32();
                            break;
                        }
                    case 15: {
                            message.legendaryBaseDamage = reader.double();
                            break;
                        }
                    case 16: {
                            if (!(message.legendaryBaseAffixes && message.legendaryBaseAffixes.length))
                                message.legendaryBaseAffixes = [];
                            message.legendaryBaseAffixes.push($root.arcade.dungeon.DungeonWeaponAffix.decode(reader, reader.uint32(), undefined, long + 1));
                            break;
                        }
                    case 17: {
                            message.signature = reader.string();
                            break;
                        }
                    case 18: {
                            message.swordNumber = reader.int32();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7, long);
                        break;
                    }
                }
                if (length !== undefined) {
                    if (reader.pos !== end)
                        throw RangeError("index out of range");
                    reader.len = length;
                }
                return message;
            };

            /**
             * Decodes a DungeonWeapon message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof arcade.dungeon.DungeonWeapon
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {arcade.dungeon.DungeonWeapon} DungeonWeapon
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonWeapon.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a DungeonWeapon message.
             * @function verify
             * @memberof arcade.dungeon.DungeonWeapon
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            DungeonWeapon.verify = function verify(message, long) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    return "maximum nesting depth exceeded";
                let properties = {};
                if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                    if (!$util.isString(message.id))
                        return "id: string expected";
                if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                    if (!$util.isString(message.name))
                        return "name: string expected";
                if (message.type != null && Object.hasOwnProperty.call(message, "type"))
                    if (!$util.isString(message.type))
                        return "type: string expected";
                if (message.archetype != null && Object.hasOwnProperty.call(message, "archetype"))
                    if (!$util.isString(message.archetype))
                        return "archetype: string expected";
                if (message.rarity != null && Object.hasOwnProperty.call(message, "rarity"))
                    if (!$util.isString(message.rarity))
                        return "rarity: string expected";
                if (message.damage != null && Object.hasOwnProperty.call(message, "damage")) {
                    properties._damage = 1;
                    if (typeof message.damage !== "number")
                        return "damage: number expected";
                }
                if (message.vfxTheme != null && Object.hasOwnProperty.call(message, "vfxTheme"))
                    if (!$util.isString(message.vfxTheme))
                        return "vfxTheme: string expected";
                if (message.vfxVariant != null && Object.hasOwnProperty.call(message, "vfxVariant")) {
                    properties._vfxVariant = 1;
                    if (!$util.isInteger(message.vfxVariant))
                        return "vfxVariant: integer expected";
                }
                if (message.affixes != null && Object.hasOwnProperty.call(message, "affixes")) {
                    if (!Array.isArray(message.affixes))
                        return "affixes: array expected";
                    for (let i = 0; i < message.affixes.length; ++i) {
                        let error = $root.arcade.dungeon.DungeonWeaponAffix.verify(message.affixes[i], long + 1);
                        if (error)
                            return "affixes." + error;
                    }
                }
                if (message.legendaryLevel != null && Object.hasOwnProperty.call(message, "legendaryLevel")) {
                    properties._legendaryLevel = 1;
                    if (!$util.isInteger(message.legendaryLevel))
                        return "legendaryLevel: integer expected";
                }
                if (message.signatureAffixes != null && Object.hasOwnProperty.call(message, "signatureAffixes")) {
                    if (!Array.isArray(message.signatureAffixes))
                        return "signatureAffixes: array expected";
                    for (let i = 0; i < message.signatureAffixes.length; ++i)
                        if (!$util.isString(message.signatureAffixes[i]))
                            return "signatureAffixes: string[] expected";
                }
                if (message.baseDamage != null && Object.hasOwnProperty.call(message, "baseDamage")) {
                    properties._baseDamage = 1;
                    if (typeof message.baseDamage !== "number")
                        return "baseDamage: number expected";
                }
                if (message.bossOnly != null && Object.hasOwnProperty.call(message, "bossOnly")) {
                    properties._bossOnly = 1;
                    if (typeof message.bossOnly !== "boolean")
                        return "bossOnly: boolean expected";
                }
                if (message.minFloor != null && Object.hasOwnProperty.call(message, "minFloor")) {
                    properties._minFloor = 1;
                    if (!$util.isInteger(message.minFloor))
                        return "minFloor: integer expected";
                }
                if (message.legendaryBaseDamage != null && Object.hasOwnProperty.call(message, "legendaryBaseDamage")) {
                    properties._legendaryBaseDamage = 1;
                    if (typeof message.legendaryBaseDamage !== "number")
                        return "legendaryBaseDamage: number expected";
                }
                if (message.legendaryBaseAffixes != null && Object.hasOwnProperty.call(message, "legendaryBaseAffixes")) {
                    if (!Array.isArray(message.legendaryBaseAffixes))
                        return "legendaryBaseAffixes: array expected";
                    for (let i = 0; i < message.legendaryBaseAffixes.length; ++i) {
                        let error = $root.arcade.dungeon.DungeonWeaponAffix.verify(message.legendaryBaseAffixes[i], long + 1);
                        if (error)
                            return "legendaryBaseAffixes." + error;
                    }
                }
                if (message.signature != null && Object.hasOwnProperty.call(message, "signature"))
                    if (!$util.isString(message.signature))
                        return "signature: string expected";
                if (message.swordNumber != null && Object.hasOwnProperty.call(message, "swordNumber")) {
                    properties._swordNumber = 1;
                    if (!$util.isInteger(message.swordNumber))
                        return "swordNumber: integer expected";
                }
                return null;
            };

            /**
             * Creates a DungeonWeapon message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof arcade.dungeon.DungeonWeapon
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {arcade.dungeon.DungeonWeapon} DungeonWeapon
             */
            DungeonWeapon.fromObject = function fromObject(object, long) {
                if (object instanceof $root.arcade.dungeon.DungeonWeapon)
                    return object;
                if (!$util.isObject(object))
                    throw TypeError(".arcade.dungeon.DungeonWeapon: object expected");
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let message = new $root.arcade.dungeon.DungeonWeapon();
                if (object.id != null)
                    message.id = String(object.id);
                if (object.name != null)
                    message.name = String(object.name);
                if (object.type != null)
                    message.type = String(object.type);
                if (object.archetype != null)
                    message.archetype = String(object.archetype);
                if (object.rarity != null)
                    message.rarity = String(object.rarity);
                if (object.damage != null)
                    message.damage = Number(object.damage);
                if (object.vfxTheme != null)
                    message.vfxTheme = String(object.vfxTheme);
                if (object.vfxVariant != null)
                    message.vfxVariant = object.vfxVariant | 0;
                if (object.affixes) {
                    if (!Array.isArray(object.affixes))
                        throw TypeError(".arcade.dungeon.DungeonWeapon.affixes: array expected");
                    message.affixes = [];
                    for (let i = 0; i < object.affixes.length; ++i) {
                        if (!$util.isObject(object.affixes[i]))
                            throw TypeError(".arcade.dungeon.DungeonWeapon.affixes: object expected");
                        message.affixes[i] = $root.arcade.dungeon.DungeonWeaponAffix.fromObject(object.affixes[i], long + 1);
                    }
                }
                if (object.legendaryLevel != null)
                    message.legendaryLevel = object.legendaryLevel | 0;
                if (object.signatureAffixes) {
                    if (!Array.isArray(object.signatureAffixes))
                        throw TypeError(".arcade.dungeon.DungeonWeapon.signatureAffixes: array expected");
                    message.signatureAffixes = [];
                    for (let i = 0; i < object.signatureAffixes.length; ++i)
                        message.signatureAffixes[i] = String(object.signatureAffixes[i]);
                }
                if (object.baseDamage != null)
                    message.baseDamage = Number(object.baseDamage);
                if (object.bossOnly != null)
                    message.bossOnly = Boolean(object.bossOnly);
                if (object.minFloor != null)
                    message.minFloor = object.minFloor | 0;
                if (object.legendaryBaseDamage != null)
                    message.legendaryBaseDamage = Number(object.legendaryBaseDamage);
                if (object.legendaryBaseAffixes) {
                    if (!Array.isArray(object.legendaryBaseAffixes))
                        throw TypeError(".arcade.dungeon.DungeonWeapon.legendaryBaseAffixes: array expected");
                    message.legendaryBaseAffixes = [];
                    for (let i = 0; i < object.legendaryBaseAffixes.length; ++i) {
                        if (!$util.isObject(object.legendaryBaseAffixes[i]))
                            throw TypeError(".arcade.dungeon.DungeonWeapon.legendaryBaseAffixes: object expected");
                        message.legendaryBaseAffixes[i] = $root.arcade.dungeon.DungeonWeaponAffix.fromObject(object.legendaryBaseAffixes[i], long + 1);
                    }
                }
                if (object.signature != null)
                    message.signature = String(object.signature);
                if (object.swordNumber != null)
                    message.swordNumber = object.swordNumber | 0;
                return message;
            };

            /**
             * Creates a plain object from a DungeonWeapon message. Also converts values to other types if specified.
             * @function toObject
             * @memberof arcade.dungeon.DungeonWeapon
             * @static
             * @param {arcade.dungeon.DungeonWeapon} message DungeonWeapon
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            DungeonWeapon.toObject = function toObject(message, options, q) {
                if (!options)
                    options = {};
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                let object = {};
                if (options.arrays || options.defaults) {
                    object.affixes = [];
                    object.signatureAffixes = [];
                    object.legendaryBaseAffixes = [];
                }
                if (options.defaults) {
                    object.id = "";
                    object.name = "";
                    object.type = "";
                    object.archetype = "";
                    object.rarity = "";
                    object.vfxTheme = "";
                    object.signature = "";
                }
                if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                    object.id = message.id;
                if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                    object.name = message.name;
                if (message.type != null && Object.hasOwnProperty.call(message, "type"))
                    object.type = message.type;
                if (message.archetype != null && Object.hasOwnProperty.call(message, "archetype"))
                    object.archetype = message.archetype;
                if (message.rarity != null && Object.hasOwnProperty.call(message, "rarity"))
                    object.rarity = message.rarity;
                if (message.damage != null && Object.hasOwnProperty.call(message, "damage")) {
                    object.damage = options.json && !isFinite(message.damage) ? String(message.damage) : message.damage;
                    if (options.oneofs)
                        object._damage = "damage";
                }
                if (message.vfxTheme != null && Object.hasOwnProperty.call(message, "vfxTheme"))
                    object.vfxTheme = message.vfxTheme;
                if (message.vfxVariant != null && Object.hasOwnProperty.call(message, "vfxVariant")) {
                    object.vfxVariant = message.vfxVariant;
                    if (options.oneofs)
                        object._vfxVariant = "vfxVariant";
                }
                if (message.affixes && message.affixes.length) {
                    object.affixes = [];
                    for (let j = 0; j < message.affixes.length; ++j)
                        object.affixes[j] = $root.arcade.dungeon.DungeonWeaponAffix.toObject(message.affixes[j], options, q + 1);
                }
                if (message.legendaryLevel != null && Object.hasOwnProperty.call(message, "legendaryLevel")) {
                    object.legendaryLevel = message.legendaryLevel;
                    if (options.oneofs)
                        object._legendaryLevel = "legendaryLevel";
                }
                if (message.signatureAffixes && message.signatureAffixes.length) {
                    object.signatureAffixes = [];
                    for (let j = 0; j < message.signatureAffixes.length; ++j)
                        object.signatureAffixes[j] = message.signatureAffixes[j];
                }
                if (message.baseDamage != null && Object.hasOwnProperty.call(message, "baseDamage")) {
                    object.baseDamage = options.json && !isFinite(message.baseDamage) ? String(message.baseDamage) : message.baseDamage;
                    if (options.oneofs)
                        object._baseDamage = "baseDamage";
                }
                if (message.bossOnly != null && Object.hasOwnProperty.call(message, "bossOnly")) {
                    object.bossOnly = message.bossOnly;
                    if (options.oneofs)
                        object._bossOnly = "bossOnly";
                }
                if (message.minFloor != null && Object.hasOwnProperty.call(message, "minFloor")) {
                    object.minFloor = message.minFloor;
                    if (options.oneofs)
                        object._minFloor = "minFloor";
                }
                if (message.legendaryBaseDamage != null && Object.hasOwnProperty.call(message, "legendaryBaseDamage")) {
                    object.legendaryBaseDamage = options.json && !isFinite(message.legendaryBaseDamage) ? String(message.legendaryBaseDamage) : message.legendaryBaseDamage;
                    if (options.oneofs)
                        object._legendaryBaseDamage = "legendaryBaseDamage";
                }
                if (message.legendaryBaseAffixes && message.legendaryBaseAffixes.length) {
                    object.legendaryBaseAffixes = [];
                    for (let j = 0; j < message.legendaryBaseAffixes.length; ++j)
                        object.legendaryBaseAffixes[j] = $root.arcade.dungeon.DungeonWeaponAffix.toObject(message.legendaryBaseAffixes[j], options, q + 1);
                }
                if (message.signature != null && Object.hasOwnProperty.call(message, "signature"))
                    object.signature = message.signature;
                if (message.swordNumber != null && Object.hasOwnProperty.call(message, "swordNumber")) {
                    object.swordNumber = message.swordNumber;
                    if (options.oneofs)
                        object._swordNumber = "swordNumber";
                }
                return object;
            };

            /**
             * Converts this DungeonWeapon to JSON.
             * @function toJSON
             * @memberof arcade.dungeon.DungeonWeapon
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            DungeonWeapon.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for DungeonWeapon
             * @function getTypeUrl
             * @memberof arcade.dungeon.DungeonWeapon
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            DungeonWeapon.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/arcade.dungeon.DungeonWeapon";
            };

            return DungeonWeapon;
        })();

        dungeon.DungeonEquipment = (function() {

            /**
             * Properties of a DungeonEquipment.
             * @memberof arcade.dungeon
             * @interface IDungeonEquipment
             * @property {arcade.dungeon.IDungeonWeapon|null} [weapon] DungeonEquipment weapon
             */

            /**
             * Constructs a new DungeonEquipment.
             * @memberof arcade.dungeon
             * @classdesc Represents a DungeonEquipment.
             * @implements IDungeonEquipment
             * @constructor
             * @param {arcade.dungeon.IDungeonEquipment=} [properties] Properties to set
             */
            function DungeonEquipment(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * DungeonEquipment weapon.
             * @member {arcade.dungeon.IDungeonWeapon|null|undefined} weapon
             * @memberof arcade.dungeon.DungeonEquipment
             * @instance
             */
            DungeonEquipment.prototype.weapon = null;

            /**
             * Creates a new DungeonEquipment instance using the specified properties.
             * @function create
             * @memberof arcade.dungeon.DungeonEquipment
             * @static
             * @param {arcade.dungeon.IDungeonEquipment=} [properties] Properties to set
             * @returns {arcade.dungeon.DungeonEquipment} DungeonEquipment instance
             */
            DungeonEquipment.create = function create(properties) {
                return new DungeonEquipment(properties);
            };

            /**
             * Encodes the specified DungeonEquipment message. Does not implicitly {@link arcade.dungeon.DungeonEquipment.verify|verify} messages.
             * @function encode
             * @memberof arcade.dungeon.DungeonEquipment
             * @static
             * @param {arcade.dungeon.IDungeonEquipment} message DungeonEquipment message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonEquipment.encode = function encode(message, writer, q) {
                if (!writer)
                    writer = $Writer.create();
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                if (message.weapon != null && Object.hasOwnProperty.call(message, "weapon"))
                    $root.arcade.dungeon.DungeonWeapon.encode(message.weapon, writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
                return writer;
            };

            /**
             * Encodes the specified DungeonEquipment message, length delimited. Does not implicitly {@link arcade.dungeon.DungeonEquipment.verify|verify} messages.
             * @function encodeDelimited
             * @memberof arcade.dungeon.DungeonEquipment
             * @static
             * @param {arcade.dungeon.IDungeonEquipment} message DungeonEquipment message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonEquipment.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
            };

            /**
             * Decodes a DungeonEquipment message from the specified reader or buffer.
             * @function decode
             * @memberof arcade.dungeon.DungeonEquipment
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {arcade.dungeon.DungeonEquipment} DungeonEquipment
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonEquipment.decode = function decode(reader, length, error, long) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (long === undefined)
                    long = 0;
                if (long > $Reader.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let end, message;
                if (length === undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = new $root.arcade.dungeon.DungeonEquipment();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.weapon = $root.arcade.dungeon.DungeonWeapon.decode(reader, reader.uint32(), undefined, long + 1);
                            break;
                        }
                    default:
                        reader.skipType(tag & 7, long);
                        break;
                    }
                }
                if (length !== undefined) {
                    if (reader.pos !== end)
                        throw RangeError("index out of range");
                    reader.len = length;
                }
                return message;
            };

            /**
             * Decodes a DungeonEquipment message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof arcade.dungeon.DungeonEquipment
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {arcade.dungeon.DungeonEquipment} DungeonEquipment
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonEquipment.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a DungeonEquipment message.
             * @function verify
             * @memberof arcade.dungeon.DungeonEquipment
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            DungeonEquipment.verify = function verify(message, long) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    return "maximum nesting depth exceeded";
                if (message.weapon != null && Object.hasOwnProperty.call(message, "weapon")) {
                    let error = $root.arcade.dungeon.DungeonWeapon.verify(message.weapon, long + 1);
                    if (error)
                        return "weapon." + error;
                }
                return null;
            };

            /**
             * Creates a DungeonEquipment message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof arcade.dungeon.DungeonEquipment
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {arcade.dungeon.DungeonEquipment} DungeonEquipment
             */
            DungeonEquipment.fromObject = function fromObject(object, long) {
                if (object instanceof $root.arcade.dungeon.DungeonEquipment)
                    return object;
                if (!$util.isObject(object))
                    throw TypeError(".arcade.dungeon.DungeonEquipment: object expected");
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let message = new $root.arcade.dungeon.DungeonEquipment();
                if (object.weapon != null) {
                    if (!$util.isObject(object.weapon))
                        throw TypeError(".arcade.dungeon.DungeonEquipment.weapon: object expected");
                    message.weapon = $root.arcade.dungeon.DungeonWeapon.fromObject(object.weapon, long + 1);
                }
                return message;
            };

            /**
             * Creates a plain object from a DungeonEquipment message. Also converts values to other types if specified.
             * @function toObject
             * @memberof arcade.dungeon.DungeonEquipment
             * @static
             * @param {arcade.dungeon.DungeonEquipment} message DungeonEquipment
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            DungeonEquipment.toObject = function toObject(message, options, q) {
                if (!options)
                    options = {};
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                let object = {};
                if (options.defaults)
                    object.weapon = null;
                if (message.weapon != null && Object.hasOwnProperty.call(message, "weapon"))
                    object.weapon = $root.arcade.dungeon.DungeonWeapon.toObject(message.weapon, options, q + 1);
                return object;
            };

            /**
             * Converts this DungeonEquipment to JSON.
             * @function toJSON
             * @memberof arcade.dungeon.DungeonEquipment
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            DungeonEquipment.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for DungeonEquipment
             * @function getTypeUrl
             * @memberof arcade.dungeon.DungeonEquipment
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            DungeonEquipment.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/arcade.dungeon.DungeonEquipment";
            };

            return DungeonEquipment;
        })();

        dungeon.DungeonPlayerState = (function() {

            /**
             * Properties of a DungeonPlayerState.
             * @memberof arcade.dungeon
             * @interface IDungeonPlayerState
             * @property {number|null} [hp] DungeonPlayerState hp
             * @property {number|null} [maxHp] DungeonPlayerState maxHp
             * @property {number|null} [damage] DungeonPlayerState damage
             * @property {number|null} [critChance] DungeonPlayerState critChance
             * @property {number|null} [speed] DungeonPlayerState speed
             * @property {number|null} [critMultiplier] DungeonPlayerState critMultiplier
             * @property {arcade.dungeon.IDungeonStatSet|null} [baseStats] DungeonPlayerState baseStats
             * @property {arcade.dungeon.IDungeonEquipment|null} [equipment] DungeonPlayerState equipment
             * @property {arcade.dungeon.IDungeonModifierSet|null} [modifiers] DungeonPlayerState modifiers
             * @property {number|null} [hasteRemainingMs] DungeonPlayerState hasteRemainingMs
             * @property {number|null} [healthPotions] DungeonPlayerState healthPotions
             */

            /**
             * Constructs a new DungeonPlayerState.
             * @memberof arcade.dungeon
             * @classdesc Represents a DungeonPlayerState.
             * @implements IDungeonPlayerState
             * @constructor
             * @param {arcade.dungeon.IDungeonPlayerState=} [properties] Properties to set
             */
            function DungeonPlayerState(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * DungeonPlayerState hp.
             * @member {number|null|undefined} hp
             * @memberof arcade.dungeon.DungeonPlayerState
             * @instance
             */
            DungeonPlayerState.prototype.hp = null;

            /**
             * DungeonPlayerState maxHp.
             * @member {number|null|undefined} maxHp
             * @memberof arcade.dungeon.DungeonPlayerState
             * @instance
             */
            DungeonPlayerState.prototype.maxHp = null;

            /**
             * DungeonPlayerState damage.
             * @member {number|null|undefined} damage
             * @memberof arcade.dungeon.DungeonPlayerState
             * @instance
             */
            DungeonPlayerState.prototype.damage = null;

            /**
             * DungeonPlayerState critChance.
             * @member {number|null|undefined} critChance
             * @memberof arcade.dungeon.DungeonPlayerState
             * @instance
             */
            DungeonPlayerState.prototype.critChance = null;

            /**
             * DungeonPlayerState speed.
             * @member {number|null|undefined} speed
             * @memberof arcade.dungeon.DungeonPlayerState
             * @instance
             */
            DungeonPlayerState.prototype.speed = null;

            /**
             * DungeonPlayerState critMultiplier.
             * @member {number|null|undefined} critMultiplier
             * @memberof arcade.dungeon.DungeonPlayerState
             * @instance
             */
            DungeonPlayerState.prototype.critMultiplier = null;

            /**
             * DungeonPlayerState baseStats.
             * @member {arcade.dungeon.IDungeonStatSet|null|undefined} baseStats
             * @memberof arcade.dungeon.DungeonPlayerState
             * @instance
             */
            DungeonPlayerState.prototype.baseStats = null;

            /**
             * DungeonPlayerState equipment.
             * @member {arcade.dungeon.IDungeonEquipment|null|undefined} equipment
             * @memberof arcade.dungeon.DungeonPlayerState
             * @instance
             */
            DungeonPlayerState.prototype.equipment = null;

            /**
             * DungeonPlayerState modifiers.
             * @member {arcade.dungeon.IDungeonModifierSet|null|undefined} modifiers
             * @memberof arcade.dungeon.DungeonPlayerState
             * @instance
             */
            DungeonPlayerState.prototype.modifiers = null;

            /**
             * DungeonPlayerState hasteRemainingMs.
             * @member {number|null|undefined} hasteRemainingMs
             * @memberof arcade.dungeon.DungeonPlayerState
             * @instance
             */
            DungeonPlayerState.prototype.hasteRemainingMs = null;

            /**
             * DungeonPlayerState healthPotions.
             * @member {number|null|undefined} healthPotions
             * @memberof arcade.dungeon.DungeonPlayerState
             * @instance
             */
            DungeonPlayerState.prototype.healthPotions = null;

            // OneOf field names bound to virtual getters and setters
            let $oneOfFields;

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonPlayerState.prototype, "_hp", {
                get: $util.oneOfGetter($oneOfFields = ["hp"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonPlayerState.prototype, "_maxHp", {
                get: $util.oneOfGetter($oneOfFields = ["maxHp"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonPlayerState.prototype, "_damage", {
                get: $util.oneOfGetter($oneOfFields = ["damage"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonPlayerState.prototype, "_critChance", {
                get: $util.oneOfGetter($oneOfFields = ["critChance"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonPlayerState.prototype, "_speed", {
                get: $util.oneOfGetter($oneOfFields = ["speed"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonPlayerState.prototype, "_critMultiplier", {
                get: $util.oneOfGetter($oneOfFields = ["critMultiplier"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonPlayerState.prototype, "_hasteRemainingMs", {
                get: $util.oneOfGetter($oneOfFields = ["hasteRemainingMs"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(DungeonPlayerState.prototype, "_healthPotions", {
                get: $util.oneOfGetter($oneOfFields = ["healthPotions"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            /**
             * Creates a new DungeonPlayerState instance using the specified properties.
             * @function create
             * @memberof arcade.dungeon.DungeonPlayerState
             * @static
             * @param {arcade.dungeon.IDungeonPlayerState=} [properties] Properties to set
             * @returns {arcade.dungeon.DungeonPlayerState} DungeonPlayerState instance
             */
            DungeonPlayerState.create = function create(properties) {
                return new DungeonPlayerState(properties);
            };

            /**
             * Encodes the specified DungeonPlayerState message. Does not implicitly {@link arcade.dungeon.DungeonPlayerState.verify|verify} messages.
             * @function encode
             * @memberof arcade.dungeon.DungeonPlayerState
             * @static
             * @param {arcade.dungeon.IDungeonPlayerState} message DungeonPlayerState message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonPlayerState.encode = function encode(message, writer, q) {
                if (!writer)
                    writer = $Writer.create();
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                if (message.hp != null && Object.hasOwnProperty.call(message, "hp"))
                    writer.uint32(/* id 1, wireType 0 =*/8).int32(message.hp);
                if (message.maxHp != null && Object.hasOwnProperty.call(message, "maxHp"))
                    writer.uint32(/* id 2, wireType 0 =*/16).int32(message.maxHp);
                if (message.damage != null && Object.hasOwnProperty.call(message, "damage"))
                    writer.uint32(/* id 3, wireType 1 =*/25).double(message.damage);
                if (message.critChance != null && Object.hasOwnProperty.call(message, "critChance"))
                    writer.uint32(/* id 4, wireType 1 =*/33).double(message.critChance);
                if (message.speed != null && Object.hasOwnProperty.call(message, "speed"))
                    writer.uint32(/* id 5, wireType 1 =*/41).double(message.speed);
                if (message.critMultiplier != null && Object.hasOwnProperty.call(message, "critMultiplier"))
                    writer.uint32(/* id 6, wireType 1 =*/49).double(message.critMultiplier);
                if (message.baseStats != null && Object.hasOwnProperty.call(message, "baseStats"))
                    $root.arcade.dungeon.DungeonStatSet.encode(message.baseStats, writer.uint32(/* id 7, wireType 2 =*/58).fork(), q + 1).ldelim();
                if (message.equipment != null && Object.hasOwnProperty.call(message, "equipment"))
                    $root.arcade.dungeon.DungeonEquipment.encode(message.equipment, writer.uint32(/* id 8, wireType 2 =*/66).fork(), q + 1).ldelim();
                if (message.modifiers != null && Object.hasOwnProperty.call(message, "modifiers"))
                    $root.arcade.dungeon.DungeonModifierSet.encode(message.modifiers, writer.uint32(/* id 9, wireType 2 =*/74).fork(), q + 1).ldelim();
                if (message.hasteRemainingMs != null && Object.hasOwnProperty.call(message, "hasteRemainingMs"))
                    writer.uint32(/* id 10, wireType 1 =*/81).double(message.hasteRemainingMs);
                if (message.healthPotions != null && Object.hasOwnProperty.call(message, "healthPotions"))
                    writer.uint32(/* id 11, wireType 0 =*/88).int32(message.healthPotions);
                return writer;
            };

            /**
             * Encodes the specified DungeonPlayerState message, length delimited. Does not implicitly {@link arcade.dungeon.DungeonPlayerState.verify|verify} messages.
             * @function encodeDelimited
             * @memberof arcade.dungeon.DungeonPlayerState
             * @static
             * @param {arcade.dungeon.IDungeonPlayerState} message DungeonPlayerState message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonPlayerState.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
            };

            /**
             * Decodes a DungeonPlayerState message from the specified reader or buffer.
             * @function decode
             * @memberof arcade.dungeon.DungeonPlayerState
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {arcade.dungeon.DungeonPlayerState} DungeonPlayerState
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonPlayerState.decode = function decode(reader, length, error, long) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (long === undefined)
                    long = 0;
                if (long > $Reader.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let end, message;
                if (length === undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = new $root.arcade.dungeon.DungeonPlayerState();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.hp = reader.int32();
                            break;
                        }
                    case 2: {
                            message.maxHp = reader.int32();
                            break;
                        }
                    case 3: {
                            message.damage = reader.double();
                            break;
                        }
                    case 4: {
                            message.critChance = reader.double();
                            break;
                        }
                    case 5: {
                            message.speed = reader.double();
                            break;
                        }
                    case 6: {
                            message.critMultiplier = reader.double();
                            break;
                        }
                    case 7: {
                            message.baseStats = $root.arcade.dungeon.DungeonStatSet.decode(reader, reader.uint32(), undefined, long + 1);
                            break;
                        }
                    case 8: {
                            message.equipment = $root.arcade.dungeon.DungeonEquipment.decode(reader, reader.uint32(), undefined, long + 1);
                            break;
                        }
                    case 9: {
                            message.modifiers = $root.arcade.dungeon.DungeonModifierSet.decode(reader, reader.uint32(), undefined, long + 1);
                            break;
                        }
                    case 10: {
                            message.hasteRemainingMs = reader.double();
                            break;
                        }
                    case 11: {
                            message.healthPotions = reader.int32();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7, long);
                        break;
                    }
                }
                if (length !== undefined) {
                    if (reader.pos !== end)
                        throw RangeError("index out of range");
                    reader.len = length;
                }
                return message;
            };

            /**
             * Decodes a DungeonPlayerState message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof arcade.dungeon.DungeonPlayerState
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {arcade.dungeon.DungeonPlayerState} DungeonPlayerState
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonPlayerState.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a DungeonPlayerState message.
             * @function verify
             * @memberof arcade.dungeon.DungeonPlayerState
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            DungeonPlayerState.verify = function verify(message, long) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    return "maximum nesting depth exceeded";
                let properties = {};
                if (message.hp != null && Object.hasOwnProperty.call(message, "hp")) {
                    properties._hp = 1;
                    if (!$util.isInteger(message.hp))
                        return "hp: integer expected";
                }
                if (message.maxHp != null && Object.hasOwnProperty.call(message, "maxHp")) {
                    properties._maxHp = 1;
                    if (!$util.isInteger(message.maxHp))
                        return "maxHp: integer expected";
                }
                if (message.damage != null && Object.hasOwnProperty.call(message, "damage")) {
                    properties._damage = 1;
                    if (typeof message.damage !== "number")
                        return "damage: number expected";
                }
                if (message.critChance != null && Object.hasOwnProperty.call(message, "critChance")) {
                    properties._critChance = 1;
                    if (typeof message.critChance !== "number")
                        return "critChance: number expected";
                }
                if (message.speed != null && Object.hasOwnProperty.call(message, "speed")) {
                    properties._speed = 1;
                    if (typeof message.speed !== "number")
                        return "speed: number expected";
                }
                if (message.critMultiplier != null && Object.hasOwnProperty.call(message, "critMultiplier")) {
                    properties._critMultiplier = 1;
                    if (typeof message.critMultiplier !== "number")
                        return "critMultiplier: number expected";
                }
                if (message.baseStats != null && Object.hasOwnProperty.call(message, "baseStats")) {
                    let error = $root.arcade.dungeon.DungeonStatSet.verify(message.baseStats, long + 1);
                    if (error)
                        return "baseStats." + error;
                }
                if (message.equipment != null && Object.hasOwnProperty.call(message, "equipment")) {
                    let error = $root.arcade.dungeon.DungeonEquipment.verify(message.equipment, long + 1);
                    if (error)
                        return "equipment." + error;
                }
                if (message.modifiers != null && Object.hasOwnProperty.call(message, "modifiers")) {
                    let error = $root.arcade.dungeon.DungeonModifierSet.verify(message.modifiers, long + 1);
                    if (error)
                        return "modifiers." + error;
                }
                if (message.hasteRemainingMs != null && Object.hasOwnProperty.call(message, "hasteRemainingMs")) {
                    properties._hasteRemainingMs = 1;
                    if (typeof message.hasteRemainingMs !== "number")
                        return "hasteRemainingMs: number expected";
                }
                if (message.healthPotions != null && Object.hasOwnProperty.call(message, "healthPotions")) {
                    properties._healthPotions = 1;
                    if (!$util.isInteger(message.healthPotions))
                        return "healthPotions: integer expected";
                }
                return null;
            };

            /**
             * Creates a DungeonPlayerState message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof arcade.dungeon.DungeonPlayerState
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {arcade.dungeon.DungeonPlayerState} DungeonPlayerState
             */
            DungeonPlayerState.fromObject = function fromObject(object, long) {
                if (object instanceof $root.arcade.dungeon.DungeonPlayerState)
                    return object;
                if (!$util.isObject(object))
                    throw TypeError(".arcade.dungeon.DungeonPlayerState: object expected");
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let message = new $root.arcade.dungeon.DungeonPlayerState();
                if (object.hp != null)
                    message.hp = object.hp | 0;
                if (object.maxHp != null)
                    message.maxHp = object.maxHp | 0;
                if (object.damage != null)
                    message.damage = Number(object.damage);
                if (object.critChance != null)
                    message.critChance = Number(object.critChance);
                if (object.speed != null)
                    message.speed = Number(object.speed);
                if (object.critMultiplier != null)
                    message.critMultiplier = Number(object.critMultiplier);
                if (object.baseStats != null) {
                    if (!$util.isObject(object.baseStats))
                        throw TypeError(".arcade.dungeon.DungeonPlayerState.baseStats: object expected");
                    message.baseStats = $root.arcade.dungeon.DungeonStatSet.fromObject(object.baseStats, long + 1);
                }
                if (object.equipment != null) {
                    if (!$util.isObject(object.equipment))
                        throw TypeError(".arcade.dungeon.DungeonPlayerState.equipment: object expected");
                    message.equipment = $root.arcade.dungeon.DungeonEquipment.fromObject(object.equipment, long + 1);
                }
                if (object.modifiers != null) {
                    if (!$util.isObject(object.modifiers))
                        throw TypeError(".arcade.dungeon.DungeonPlayerState.modifiers: object expected");
                    message.modifiers = $root.arcade.dungeon.DungeonModifierSet.fromObject(object.modifiers, long + 1);
                }
                if (object.hasteRemainingMs != null)
                    message.hasteRemainingMs = Number(object.hasteRemainingMs);
                if (object.healthPotions != null)
                    message.healthPotions = object.healthPotions | 0;
                return message;
            };

            /**
             * Creates a plain object from a DungeonPlayerState message. Also converts values to other types if specified.
             * @function toObject
             * @memberof arcade.dungeon.DungeonPlayerState
             * @static
             * @param {arcade.dungeon.DungeonPlayerState} message DungeonPlayerState
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            DungeonPlayerState.toObject = function toObject(message, options, q) {
                if (!options)
                    options = {};
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    object.baseStats = null;
                    object.equipment = null;
                    object.modifiers = null;
                }
                if (message.hp != null && Object.hasOwnProperty.call(message, "hp")) {
                    object.hp = message.hp;
                    if (options.oneofs)
                        object._hp = "hp";
                }
                if (message.maxHp != null && Object.hasOwnProperty.call(message, "maxHp")) {
                    object.maxHp = message.maxHp;
                    if (options.oneofs)
                        object._maxHp = "maxHp";
                }
                if (message.damage != null && Object.hasOwnProperty.call(message, "damage")) {
                    object.damage = options.json && !isFinite(message.damage) ? String(message.damage) : message.damage;
                    if (options.oneofs)
                        object._damage = "damage";
                }
                if (message.critChance != null && Object.hasOwnProperty.call(message, "critChance")) {
                    object.critChance = options.json && !isFinite(message.critChance) ? String(message.critChance) : message.critChance;
                    if (options.oneofs)
                        object._critChance = "critChance";
                }
                if (message.speed != null && Object.hasOwnProperty.call(message, "speed")) {
                    object.speed = options.json && !isFinite(message.speed) ? String(message.speed) : message.speed;
                    if (options.oneofs)
                        object._speed = "speed";
                }
                if (message.critMultiplier != null && Object.hasOwnProperty.call(message, "critMultiplier")) {
                    object.critMultiplier = options.json && !isFinite(message.critMultiplier) ? String(message.critMultiplier) : message.critMultiplier;
                    if (options.oneofs)
                        object._critMultiplier = "critMultiplier";
                }
                if (message.baseStats != null && Object.hasOwnProperty.call(message, "baseStats"))
                    object.baseStats = $root.arcade.dungeon.DungeonStatSet.toObject(message.baseStats, options, q + 1);
                if (message.equipment != null && Object.hasOwnProperty.call(message, "equipment"))
                    object.equipment = $root.arcade.dungeon.DungeonEquipment.toObject(message.equipment, options, q + 1);
                if (message.modifiers != null && Object.hasOwnProperty.call(message, "modifiers"))
                    object.modifiers = $root.arcade.dungeon.DungeonModifierSet.toObject(message.modifiers, options, q + 1);
                if (message.hasteRemainingMs != null && Object.hasOwnProperty.call(message, "hasteRemainingMs")) {
                    object.hasteRemainingMs = options.json && !isFinite(message.hasteRemainingMs) ? String(message.hasteRemainingMs) : message.hasteRemainingMs;
                    if (options.oneofs)
                        object._hasteRemainingMs = "hasteRemainingMs";
                }
                if (message.healthPotions != null && Object.hasOwnProperty.call(message, "healthPotions")) {
                    object.healthPotions = message.healthPotions;
                    if (options.oneofs)
                        object._healthPotions = "healthPotions";
                }
                return object;
            };

            /**
             * Converts this DungeonPlayerState to JSON.
             * @function toJSON
             * @memberof arcade.dungeon.DungeonPlayerState
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            DungeonPlayerState.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for DungeonPlayerState
             * @function getTypeUrl
             * @memberof arcade.dungeon.DungeonPlayerState
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            DungeonPlayerState.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/arcade.dungeon.DungeonPlayerState";
            };

            return DungeonPlayerState;
        })();

        dungeon.DungeonSnapshotRequest = (function() {

            /**
             * Properties of a DungeonSnapshotRequest.
             * @memberof arcade.dungeon
             * @interface IDungeonSnapshotRequest
             * @property {string|null} [roomId] DungeonSnapshotRequest roomId
             * @property {arcade.dungeon.IDungeonPresenceSnapshot|null} [snapshot] DungeonSnapshotRequest snapshot
             * @property {arcade.dungeon.IDungeonPlayerState|null} [playerState] DungeonSnapshotRequest playerState
             */

            /**
             * Constructs a new DungeonSnapshotRequest.
             * @memberof arcade.dungeon
             * @classdesc Represents a DungeonSnapshotRequest.
             * @implements IDungeonSnapshotRequest
             * @constructor
             * @param {arcade.dungeon.IDungeonSnapshotRequest=} [properties] Properties to set
             */
            function DungeonSnapshotRequest(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * DungeonSnapshotRequest roomId.
             * @member {string} roomId
             * @memberof arcade.dungeon.DungeonSnapshotRequest
             * @instance
             */
            DungeonSnapshotRequest.prototype.roomId = "";

            /**
             * DungeonSnapshotRequest snapshot.
             * @member {arcade.dungeon.IDungeonPresenceSnapshot|null|undefined} snapshot
             * @memberof arcade.dungeon.DungeonSnapshotRequest
             * @instance
             */
            DungeonSnapshotRequest.prototype.snapshot = null;

            /**
             * DungeonSnapshotRequest playerState.
             * @member {arcade.dungeon.IDungeonPlayerState|null|undefined} playerState
             * @memberof arcade.dungeon.DungeonSnapshotRequest
             * @instance
             */
            DungeonSnapshotRequest.prototype.playerState = null;

            /**
             * Creates a new DungeonSnapshotRequest instance using the specified properties.
             * @function create
             * @memberof arcade.dungeon.DungeonSnapshotRequest
             * @static
             * @param {arcade.dungeon.IDungeonSnapshotRequest=} [properties] Properties to set
             * @returns {arcade.dungeon.DungeonSnapshotRequest} DungeonSnapshotRequest instance
             */
            DungeonSnapshotRequest.create = function create(properties) {
                return new DungeonSnapshotRequest(properties);
            };

            /**
             * Encodes the specified DungeonSnapshotRequest message. Does not implicitly {@link arcade.dungeon.DungeonSnapshotRequest.verify|verify} messages.
             * @function encode
             * @memberof arcade.dungeon.DungeonSnapshotRequest
             * @static
             * @param {arcade.dungeon.IDungeonSnapshotRequest} message DungeonSnapshotRequest message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonSnapshotRequest.encode = function encode(message, writer, q) {
                if (!writer)
                    writer = $Writer.create();
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                if (message.roomId != null && Object.hasOwnProperty.call(message, "roomId"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.roomId);
                if (message.snapshot != null && Object.hasOwnProperty.call(message, "snapshot"))
                    $root.arcade.dungeon.DungeonPresenceSnapshot.encode(message.snapshot, writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
                if (message.playerState != null && Object.hasOwnProperty.call(message, "playerState"))
                    $root.arcade.dungeon.DungeonPlayerState.encode(message.playerState, writer.uint32(/* id 3, wireType 2 =*/26).fork(), q + 1).ldelim();
                return writer;
            };

            /**
             * Encodes the specified DungeonSnapshotRequest message, length delimited. Does not implicitly {@link arcade.dungeon.DungeonSnapshotRequest.verify|verify} messages.
             * @function encodeDelimited
             * @memberof arcade.dungeon.DungeonSnapshotRequest
             * @static
             * @param {arcade.dungeon.IDungeonSnapshotRequest} message DungeonSnapshotRequest message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonSnapshotRequest.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
            };

            /**
             * Decodes a DungeonSnapshotRequest message from the specified reader or buffer.
             * @function decode
             * @memberof arcade.dungeon.DungeonSnapshotRequest
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {arcade.dungeon.DungeonSnapshotRequest} DungeonSnapshotRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonSnapshotRequest.decode = function decode(reader, length, error, long) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (long === undefined)
                    long = 0;
                if (long > $Reader.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let end, message;
                if (length === undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = new $root.arcade.dungeon.DungeonSnapshotRequest();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.roomId = reader.string();
                            break;
                        }
                    case 2: {
                            message.snapshot = $root.arcade.dungeon.DungeonPresenceSnapshot.decode(reader, reader.uint32(), undefined, long + 1);
                            break;
                        }
                    case 3: {
                            message.playerState = $root.arcade.dungeon.DungeonPlayerState.decode(reader, reader.uint32(), undefined, long + 1);
                            break;
                        }
                    default:
                        reader.skipType(tag & 7, long);
                        break;
                    }
                }
                if (length !== undefined) {
                    if (reader.pos !== end)
                        throw RangeError("index out of range");
                    reader.len = length;
                }
                return message;
            };

            /**
             * Decodes a DungeonSnapshotRequest message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof arcade.dungeon.DungeonSnapshotRequest
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {arcade.dungeon.DungeonSnapshotRequest} DungeonSnapshotRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonSnapshotRequest.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a DungeonSnapshotRequest message.
             * @function verify
             * @memberof arcade.dungeon.DungeonSnapshotRequest
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            DungeonSnapshotRequest.verify = function verify(message, long) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    return "maximum nesting depth exceeded";
                if (message.roomId != null && Object.hasOwnProperty.call(message, "roomId"))
                    if (!$util.isString(message.roomId))
                        return "roomId: string expected";
                if (message.snapshot != null && Object.hasOwnProperty.call(message, "snapshot")) {
                    let error = $root.arcade.dungeon.DungeonPresenceSnapshot.verify(message.snapshot, long + 1);
                    if (error)
                        return "snapshot." + error;
                }
                if (message.playerState != null && Object.hasOwnProperty.call(message, "playerState")) {
                    let error = $root.arcade.dungeon.DungeonPlayerState.verify(message.playerState, long + 1);
                    if (error)
                        return "playerState." + error;
                }
                return null;
            };

            /**
             * Creates a DungeonSnapshotRequest message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof arcade.dungeon.DungeonSnapshotRequest
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {arcade.dungeon.DungeonSnapshotRequest} DungeonSnapshotRequest
             */
            DungeonSnapshotRequest.fromObject = function fromObject(object, long) {
                if (object instanceof $root.arcade.dungeon.DungeonSnapshotRequest)
                    return object;
                if (!$util.isObject(object))
                    throw TypeError(".arcade.dungeon.DungeonSnapshotRequest: object expected");
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let message = new $root.arcade.dungeon.DungeonSnapshotRequest();
                if (object.roomId != null)
                    message.roomId = String(object.roomId);
                if (object.snapshot != null) {
                    if (!$util.isObject(object.snapshot))
                        throw TypeError(".arcade.dungeon.DungeonSnapshotRequest.snapshot: object expected");
                    message.snapshot = $root.arcade.dungeon.DungeonPresenceSnapshot.fromObject(object.snapshot, long + 1);
                }
                if (object.playerState != null) {
                    if (!$util.isObject(object.playerState))
                        throw TypeError(".arcade.dungeon.DungeonSnapshotRequest.playerState: object expected");
                    message.playerState = $root.arcade.dungeon.DungeonPlayerState.fromObject(object.playerState, long + 1);
                }
                return message;
            };

            /**
             * Creates a plain object from a DungeonSnapshotRequest message. Also converts values to other types if specified.
             * @function toObject
             * @memberof arcade.dungeon.DungeonSnapshotRequest
             * @static
             * @param {arcade.dungeon.DungeonSnapshotRequest} message DungeonSnapshotRequest
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            DungeonSnapshotRequest.toObject = function toObject(message, options, q) {
                if (!options)
                    options = {};
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    object.roomId = "";
                    object.snapshot = null;
                    object.playerState = null;
                }
                if (message.roomId != null && Object.hasOwnProperty.call(message, "roomId"))
                    object.roomId = message.roomId;
                if (message.snapshot != null && Object.hasOwnProperty.call(message, "snapshot"))
                    object.snapshot = $root.arcade.dungeon.DungeonPresenceSnapshot.toObject(message.snapshot, options, q + 1);
                if (message.playerState != null && Object.hasOwnProperty.call(message, "playerState"))
                    object.playerState = $root.arcade.dungeon.DungeonPlayerState.toObject(message.playerState, options, q + 1);
                return object;
            };

            /**
             * Converts this DungeonSnapshotRequest to JSON.
             * @function toJSON
             * @memberof arcade.dungeon.DungeonSnapshotRequest
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            DungeonSnapshotRequest.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for DungeonSnapshotRequest
             * @function getTypeUrl
             * @memberof arcade.dungeon.DungeonSnapshotRequest
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            DungeonSnapshotRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/arcade.dungeon.DungeonSnapshotRequest";
            };

            return DungeonSnapshotRequest;
        })();

        dungeon.DungeonSnapshotRelay = (function() {

            /**
             * Properties of a DungeonSnapshotRelay.
             * @memberof arcade.dungeon
             * @interface IDungeonSnapshotRelay
             * @property {string|null} [playerId] DungeonSnapshotRelay playerId
             * @property {arcade.dungeon.IDungeonPresenceSnapshot|null} [snapshot] DungeonSnapshotRelay snapshot
             * @property {arcade.dungeon.IDungeonPlayerState|null} [playerState] DungeonSnapshotRelay playerState
             */

            /**
             * Constructs a new DungeonSnapshotRelay.
             * @memberof arcade.dungeon
             * @classdesc Represents a DungeonSnapshotRelay.
             * @implements IDungeonSnapshotRelay
             * @constructor
             * @param {arcade.dungeon.IDungeonSnapshotRelay=} [properties] Properties to set
             */
            function DungeonSnapshotRelay(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * DungeonSnapshotRelay playerId.
             * @member {string} playerId
             * @memberof arcade.dungeon.DungeonSnapshotRelay
             * @instance
             */
            DungeonSnapshotRelay.prototype.playerId = "";

            /**
             * DungeonSnapshotRelay snapshot.
             * @member {arcade.dungeon.IDungeonPresenceSnapshot|null|undefined} snapshot
             * @memberof arcade.dungeon.DungeonSnapshotRelay
             * @instance
             */
            DungeonSnapshotRelay.prototype.snapshot = null;

            /**
             * DungeonSnapshotRelay playerState.
             * @member {arcade.dungeon.IDungeonPlayerState|null|undefined} playerState
             * @memberof arcade.dungeon.DungeonSnapshotRelay
             * @instance
             */
            DungeonSnapshotRelay.prototype.playerState = null;

            /**
             * Creates a new DungeonSnapshotRelay instance using the specified properties.
             * @function create
             * @memberof arcade.dungeon.DungeonSnapshotRelay
             * @static
             * @param {arcade.dungeon.IDungeonSnapshotRelay=} [properties] Properties to set
             * @returns {arcade.dungeon.DungeonSnapshotRelay} DungeonSnapshotRelay instance
             */
            DungeonSnapshotRelay.create = function create(properties) {
                return new DungeonSnapshotRelay(properties);
            };

            /**
             * Encodes the specified DungeonSnapshotRelay message. Does not implicitly {@link arcade.dungeon.DungeonSnapshotRelay.verify|verify} messages.
             * @function encode
             * @memberof arcade.dungeon.DungeonSnapshotRelay
             * @static
             * @param {arcade.dungeon.IDungeonSnapshotRelay} message DungeonSnapshotRelay message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonSnapshotRelay.encode = function encode(message, writer, q) {
                if (!writer)
                    writer = $Writer.create();
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                if (message.playerId != null && Object.hasOwnProperty.call(message, "playerId"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.playerId);
                if (message.snapshot != null && Object.hasOwnProperty.call(message, "snapshot"))
                    $root.arcade.dungeon.DungeonPresenceSnapshot.encode(message.snapshot, writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
                if (message.playerState != null && Object.hasOwnProperty.call(message, "playerState"))
                    $root.arcade.dungeon.DungeonPlayerState.encode(message.playerState, writer.uint32(/* id 3, wireType 2 =*/26).fork(), q + 1).ldelim();
                return writer;
            };

            /**
             * Encodes the specified DungeonSnapshotRelay message, length delimited. Does not implicitly {@link arcade.dungeon.DungeonSnapshotRelay.verify|verify} messages.
             * @function encodeDelimited
             * @memberof arcade.dungeon.DungeonSnapshotRelay
             * @static
             * @param {arcade.dungeon.IDungeonSnapshotRelay} message DungeonSnapshotRelay message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonSnapshotRelay.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
            };

            /**
             * Decodes a DungeonSnapshotRelay message from the specified reader or buffer.
             * @function decode
             * @memberof arcade.dungeon.DungeonSnapshotRelay
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {arcade.dungeon.DungeonSnapshotRelay} DungeonSnapshotRelay
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonSnapshotRelay.decode = function decode(reader, length, error, long) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (long === undefined)
                    long = 0;
                if (long > $Reader.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let end, message;
                if (length === undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = new $root.arcade.dungeon.DungeonSnapshotRelay();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.playerId = reader.string();
                            break;
                        }
                    case 2: {
                            message.snapshot = $root.arcade.dungeon.DungeonPresenceSnapshot.decode(reader, reader.uint32(), undefined, long + 1);
                            break;
                        }
                    case 3: {
                            message.playerState = $root.arcade.dungeon.DungeonPlayerState.decode(reader, reader.uint32(), undefined, long + 1);
                            break;
                        }
                    default:
                        reader.skipType(tag & 7, long);
                        break;
                    }
                }
                if (length !== undefined) {
                    if (reader.pos !== end)
                        throw RangeError("index out of range");
                    reader.len = length;
                }
                return message;
            };

            /**
             * Decodes a DungeonSnapshotRelay message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof arcade.dungeon.DungeonSnapshotRelay
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {arcade.dungeon.DungeonSnapshotRelay} DungeonSnapshotRelay
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonSnapshotRelay.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a DungeonSnapshotRelay message.
             * @function verify
             * @memberof arcade.dungeon.DungeonSnapshotRelay
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            DungeonSnapshotRelay.verify = function verify(message, long) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    return "maximum nesting depth exceeded";
                if (message.playerId != null && Object.hasOwnProperty.call(message, "playerId"))
                    if (!$util.isString(message.playerId))
                        return "playerId: string expected";
                if (message.snapshot != null && Object.hasOwnProperty.call(message, "snapshot")) {
                    let error = $root.arcade.dungeon.DungeonPresenceSnapshot.verify(message.snapshot, long + 1);
                    if (error)
                        return "snapshot." + error;
                }
                if (message.playerState != null && Object.hasOwnProperty.call(message, "playerState")) {
                    let error = $root.arcade.dungeon.DungeonPlayerState.verify(message.playerState, long + 1);
                    if (error)
                        return "playerState." + error;
                }
                return null;
            };

            /**
             * Creates a DungeonSnapshotRelay message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof arcade.dungeon.DungeonSnapshotRelay
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {arcade.dungeon.DungeonSnapshotRelay} DungeonSnapshotRelay
             */
            DungeonSnapshotRelay.fromObject = function fromObject(object, long) {
                if (object instanceof $root.arcade.dungeon.DungeonSnapshotRelay)
                    return object;
                if (!$util.isObject(object))
                    throw TypeError(".arcade.dungeon.DungeonSnapshotRelay: object expected");
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let message = new $root.arcade.dungeon.DungeonSnapshotRelay();
                if (object.playerId != null)
                    message.playerId = String(object.playerId);
                if (object.snapshot != null) {
                    if (!$util.isObject(object.snapshot))
                        throw TypeError(".arcade.dungeon.DungeonSnapshotRelay.snapshot: object expected");
                    message.snapshot = $root.arcade.dungeon.DungeonPresenceSnapshot.fromObject(object.snapshot, long + 1);
                }
                if (object.playerState != null) {
                    if (!$util.isObject(object.playerState))
                        throw TypeError(".arcade.dungeon.DungeonSnapshotRelay.playerState: object expected");
                    message.playerState = $root.arcade.dungeon.DungeonPlayerState.fromObject(object.playerState, long + 1);
                }
                return message;
            };

            /**
             * Creates a plain object from a DungeonSnapshotRelay message. Also converts values to other types if specified.
             * @function toObject
             * @memberof arcade.dungeon.DungeonSnapshotRelay
             * @static
             * @param {arcade.dungeon.DungeonSnapshotRelay} message DungeonSnapshotRelay
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            DungeonSnapshotRelay.toObject = function toObject(message, options, q) {
                if (!options)
                    options = {};
                if (q === undefined)
                    q = 0;
                if (q > $util.recursionLimit)
                    throw Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    object.playerId = "";
                    object.snapshot = null;
                    object.playerState = null;
                }
                if (message.playerId != null && Object.hasOwnProperty.call(message, "playerId"))
                    object.playerId = message.playerId;
                if (message.snapshot != null && Object.hasOwnProperty.call(message, "snapshot"))
                    object.snapshot = $root.arcade.dungeon.DungeonPresenceSnapshot.toObject(message.snapshot, options, q + 1);
                if (message.playerState != null && Object.hasOwnProperty.call(message, "playerState"))
                    object.playerState = $root.arcade.dungeon.DungeonPlayerState.toObject(message.playerState, options, q + 1);
                return object;
            };

            /**
             * Converts this DungeonSnapshotRelay to JSON.
             * @function toJSON
             * @memberof arcade.dungeon.DungeonSnapshotRelay
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            DungeonSnapshotRelay.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for DungeonSnapshotRelay
             * @function getTypeUrl
             * @memberof arcade.dungeon.DungeonSnapshotRelay
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            DungeonSnapshotRelay.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/arcade.dungeon.DungeonSnapshotRelay";
            };

            return DungeonSnapshotRelay;
        })();

        return dungeon;
    })();

    return arcade;
})();

export { $root as default };
