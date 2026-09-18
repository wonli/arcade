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

        dungeon.DungeonSnapshot = (function() {

            /**
             * Properties of a DungeonSnapshot.
             * @memberof arcade.dungeon
             * @interface IDungeonSnapshot
             * @property {number|null} [slot] DungeonSnapshot slot
             * @property {number|null} [x] DungeonSnapshot x
             * @property {number|null} [y] DungeonSnapshot y
             * @property {number|null} [hp] DungeonSnapshot hp
             * @property {number|null} [maxHp] DungeonSnapshot maxHp
             * @property {string|null} [facing] DungeonSnapshot facing
             * @property {boolean|null} [moving] DungeonSnapshot moving
             * @property {boolean|null} [attacking] DungeonSnapshot attacking
             * @property {boolean|null} [dead] DungeonSnapshot dead
             * @property {number|null} [lastAttackElapsedMs] DungeonSnapshot lastAttackElapsedMs
             * @property {number|null} [lastContactElapsedMs] DungeonSnapshot lastContactElapsedMs
             * @property {Object.<string,number>|null} [skillCooldownRemainingMs] DungeonSnapshot skillCooldownRemainingMs
             * @property {number|null} [hasteRemainingMs] DungeonSnapshot hasteRemainingMs
             * @property {number|null} [healthPotions] DungeonSnapshot healthPotions
             * @property {string|null} [stateJson] DungeonSnapshot stateJson
             */

            /**
             * Constructs a new DungeonSnapshot.
             * @memberof arcade.dungeon
             * @classdesc Represents a DungeonSnapshot.
             * @implements IDungeonSnapshot
             * @constructor
             * @param {arcade.dungeon.IDungeonSnapshot=} [properties] Properties to set
             */
            function DungeonSnapshot(properties) {
                this.skillCooldownRemainingMs = {};
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * DungeonSnapshot slot.
             * @member {number} slot
             * @memberof arcade.dungeon.DungeonSnapshot
             * @instance
             */
            DungeonSnapshot.prototype.slot = 0;

            /**
             * DungeonSnapshot x.
             * @member {number} x
             * @memberof arcade.dungeon.DungeonSnapshot
             * @instance
             */
            DungeonSnapshot.prototype.x = 0;

            /**
             * DungeonSnapshot y.
             * @member {number} y
             * @memberof arcade.dungeon.DungeonSnapshot
             * @instance
             */
            DungeonSnapshot.prototype.y = 0;

            /**
             * DungeonSnapshot hp.
             * @member {number} hp
             * @memberof arcade.dungeon.DungeonSnapshot
             * @instance
             */
            DungeonSnapshot.prototype.hp = 0;

            /**
             * DungeonSnapshot maxHp.
             * @member {number} maxHp
             * @memberof arcade.dungeon.DungeonSnapshot
             * @instance
             */
            DungeonSnapshot.prototype.maxHp = 0;

            /**
             * DungeonSnapshot facing.
             * @member {string} facing
             * @memberof arcade.dungeon.DungeonSnapshot
             * @instance
             */
            DungeonSnapshot.prototype.facing = "";

            /**
             * DungeonSnapshot moving.
             * @member {boolean} moving
             * @memberof arcade.dungeon.DungeonSnapshot
             * @instance
             */
            DungeonSnapshot.prototype.moving = false;

            /**
             * DungeonSnapshot attacking.
             * @member {boolean} attacking
             * @memberof arcade.dungeon.DungeonSnapshot
             * @instance
             */
            DungeonSnapshot.prototype.attacking = false;

            /**
             * DungeonSnapshot dead.
             * @member {boolean} dead
             * @memberof arcade.dungeon.DungeonSnapshot
             * @instance
             */
            DungeonSnapshot.prototype.dead = false;

            /**
             * DungeonSnapshot lastAttackElapsedMs.
             * @member {number} lastAttackElapsedMs
             * @memberof arcade.dungeon.DungeonSnapshot
             * @instance
             */
            DungeonSnapshot.prototype.lastAttackElapsedMs = 0;

            /**
             * DungeonSnapshot lastContactElapsedMs.
             * @member {number} lastContactElapsedMs
             * @memberof arcade.dungeon.DungeonSnapshot
             * @instance
             */
            DungeonSnapshot.prototype.lastContactElapsedMs = 0;

            /**
             * DungeonSnapshot skillCooldownRemainingMs.
             * @member {Object.<string,number>} skillCooldownRemainingMs
             * @memberof arcade.dungeon.DungeonSnapshot
             * @instance
             */
            DungeonSnapshot.prototype.skillCooldownRemainingMs = $util.emptyObject;

            /**
             * DungeonSnapshot hasteRemainingMs.
             * @member {number} hasteRemainingMs
             * @memberof arcade.dungeon.DungeonSnapshot
             * @instance
             */
            DungeonSnapshot.prototype.hasteRemainingMs = 0;

            /**
             * DungeonSnapshot healthPotions.
             * @member {number} healthPotions
             * @memberof arcade.dungeon.DungeonSnapshot
             * @instance
             */
            DungeonSnapshot.prototype.healthPotions = 0;

            /**
             * DungeonSnapshot stateJson.
             * @member {string} stateJson
             * @memberof arcade.dungeon.DungeonSnapshot
             * @instance
             */
            DungeonSnapshot.prototype.stateJson = "";

            /**
             * Creates a new DungeonSnapshot instance using the specified properties.
             * @function create
             * @memberof arcade.dungeon.DungeonSnapshot
             * @static
             * @param {arcade.dungeon.IDungeonSnapshot=} [properties] Properties to set
             * @returns {arcade.dungeon.DungeonSnapshot} DungeonSnapshot instance
             */
            DungeonSnapshot.create = function create(properties) {
                return new DungeonSnapshot(properties);
            };

            /**
             * Encodes the specified DungeonSnapshot message. Does not implicitly {@link arcade.dungeon.DungeonSnapshot.verify|verify} messages.
             * @function encode
             * @memberof arcade.dungeon.DungeonSnapshot
             * @static
             * @param {arcade.dungeon.IDungeonSnapshot} message DungeonSnapshot message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonSnapshot.encode = function encode(message, writer, q) {
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
                if (message.hp != null && Object.hasOwnProperty.call(message, "hp"))
                    writer.uint32(/* id 4, wireType 0 =*/32).int32(message.hp);
                if (message.maxHp != null && Object.hasOwnProperty.call(message, "maxHp"))
                    writer.uint32(/* id 5, wireType 0 =*/40).int32(message.maxHp);
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
                if (message.hasteRemainingMs != null && Object.hasOwnProperty.call(message, "hasteRemainingMs"))
                    writer.uint32(/* id 13, wireType 1 =*/105).double(message.hasteRemainingMs);
                if (message.healthPotions != null && Object.hasOwnProperty.call(message, "healthPotions"))
                    writer.uint32(/* id 14, wireType 0 =*/112).int32(message.healthPotions);
                if (message.stateJson != null && Object.hasOwnProperty.call(message, "stateJson"))
                    writer.uint32(/* id 15, wireType 2 =*/122).string(message.stateJson);
                return writer;
            };

            /**
             * Encodes the specified DungeonSnapshot message, length delimited. Does not implicitly {@link arcade.dungeon.DungeonSnapshot.verify|verify} messages.
             * @function encodeDelimited
             * @memberof arcade.dungeon.DungeonSnapshot
             * @static
             * @param {arcade.dungeon.IDungeonSnapshot} message DungeonSnapshot message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            DungeonSnapshot.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
            };

            /**
             * Decodes a DungeonSnapshot message from the specified reader or buffer.
             * @function decode
             * @memberof arcade.dungeon.DungeonSnapshot
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {arcade.dungeon.DungeonSnapshot} DungeonSnapshot
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonSnapshot.decode = function decode(reader, length, error, long) {
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
                message = new $root.arcade.dungeon.DungeonSnapshot();
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
                    case 4: {
                            message.hp = reader.int32();
                            break;
                        }
                    case 5: {
                            message.maxHp = reader.int32();
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
                    case 13: {
                            message.hasteRemainingMs = reader.double();
                            break;
                        }
                    case 14: {
                            message.healthPotions = reader.int32();
                            break;
                        }
                    case 15: {
                            message.stateJson = reader.string();
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
             * Decodes a DungeonSnapshot message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof arcade.dungeon.DungeonSnapshot
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {arcade.dungeon.DungeonSnapshot} DungeonSnapshot
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            DungeonSnapshot.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a DungeonSnapshot message.
             * @function verify
             * @memberof arcade.dungeon.DungeonSnapshot
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            DungeonSnapshot.verify = function verify(message, long) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    return "maximum nesting depth exceeded";
                if (message.slot != null && Object.hasOwnProperty.call(message, "slot"))
                    if (!$util.isInteger(message.slot))
                        return "slot: integer expected";
                if (message.x != null && Object.hasOwnProperty.call(message, "x"))
                    if (typeof message.x !== "number")
                        return "x: number expected";
                if (message.y != null && Object.hasOwnProperty.call(message, "y"))
                    if (typeof message.y !== "number")
                        return "y: number expected";
                if (message.hp != null && Object.hasOwnProperty.call(message, "hp"))
                    if (!$util.isInteger(message.hp))
                        return "hp: integer expected";
                if (message.maxHp != null && Object.hasOwnProperty.call(message, "maxHp"))
                    if (!$util.isInteger(message.maxHp))
                        return "maxHp: integer expected";
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
                if (message.lastAttackElapsedMs != null && Object.hasOwnProperty.call(message, "lastAttackElapsedMs"))
                    if (typeof message.lastAttackElapsedMs !== "number")
                        return "lastAttackElapsedMs: number expected";
                if (message.lastContactElapsedMs != null && Object.hasOwnProperty.call(message, "lastContactElapsedMs"))
                    if (typeof message.lastContactElapsedMs !== "number")
                        return "lastContactElapsedMs: number expected";
                if (message.skillCooldownRemainingMs != null && Object.hasOwnProperty.call(message, "skillCooldownRemainingMs")) {
                    if (!$util.isObject(message.skillCooldownRemainingMs))
                        return "skillCooldownRemainingMs: object expected";
                    let key = Object.keys(message.skillCooldownRemainingMs);
                    for (let i = 0; i < key.length; ++i)
                        if (typeof message.skillCooldownRemainingMs[key[i]] !== "number")
                            return "skillCooldownRemainingMs: number{k:string} expected";
                }
                if (message.hasteRemainingMs != null && Object.hasOwnProperty.call(message, "hasteRemainingMs"))
                    if (typeof message.hasteRemainingMs !== "number")
                        return "hasteRemainingMs: number expected";
                if (message.healthPotions != null && Object.hasOwnProperty.call(message, "healthPotions"))
                    if (!$util.isInteger(message.healthPotions))
                        return "healthPotions: integer expected";
                if (message.stateJson != null && Object.hasOwnProperty.call(message, "stateJson"))
                    if (!$util.isString(message.stateJson))
                        return "stateJson: string expected";
                return null;
            };

            /**
             * Creates a DungeonSnapshot message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof arcade.dungeon.DungeonSnapshot
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {arcade.dungeon.DungeonSnapshot} DungeonSnapshot
             */
            DungeonSnapshot.fromObject = function fromObject(object, long) {
                if (object instanceof $root.arcade.dungeon.DungeonSnapshot)
                    return object;
                if (!$util.isObject(object))
                    throw TypeError(".arcade.dungeon.DungeonSnapshot: object expected");
                if (long === undefined)
                    long = 0;
                if (long > $util.recursionLimit)
                    throw Error("maximum nesting depth exceeded");
                let message = new $root.arcade.dungeon.DungeonSnapshot();
                if (object.slot != null)
                    message.slot = object.slot >>> 0;
                if (object.x != null)
                    message.x = Number(object.x);
                if (object.y != null)
                    message.y = Number(object.y);
                if (object.hp != null)
                    message.hp = object.hp | 0;
                if (object.maxHp != null)
                    message.maxHp = object.maxHp | 0;
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
                        throw TypeError(".arcade.dungeon.DungeonSnapshot.skillCooldownRemainingMs: object expected");
                    message.skillCooldownRemainingMs = {};
                    for (let keys = Object.keys(object.skillCooldownRemainingMs), i = 0; i < keys.length; ++i) {
                        if (keys[i] === "__proto__")
                            $util.makeProp(message.skillCooldownRemainingMs, keys[i]);
                        message.skillCooldownRemainingMs[keys[i]] = Number(object.skillCooldownRemainingMs[keys[i]]);
                    }
                }
                if (object.hasteRemainingMs != null)
                    message.hasteRemainingMs = Number(object.hasteRemainingMs);
                if (object.healthPotions != null)
                    message.healthPotions = object.healthPotions | 0;
                if (object.stateJson != null)
                    message.stateJson = String(object.stateJson);
                return message;
            };

            /**
             * Creates a plain object from a DungeonSnapshot message. Also converts values to other types if specified.
             * @function toObject
             * @memberof arcade.dungeon.DungeonSnapshot
             * @static
             * @param {arcade.dungeon.DungeonSnapshot} message DungeonSnapshot
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            DungeonSnapshot.toObject = function toObject(message, options, q) {
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
                    object.slot = 0;
                    object.x = 0;
                    object.y = 0;
                    object.hp = 0;
                    object.maxHp = 0;
                    object.facing = "";
                    object.moving = false;
                    object.attacking = false;
                    object.dead = false;
                    object.lastAttackElapsedMs = 0;
                    object.lastContactElapsedMs = 0;
                    object.hasteRemainingMs = 0;
                    object.healthPotions = 0;
                    object.stateJson = "";
                }
                if (message.slot != null && Object.hasOwnProperty.call(message, "slot"))
                    object.slot = message.slot;
                if (message.x != null && Object.hasOwnProperty.call(message, "x"))
                    object.x = options.json && !isFinite(message.x) ? String(message.x) : message.x;
                if (message.y != null && Object.hasOwnProperty.call(message, "y"))
                    object.y = options.json && !isFinite(message.y) ? String(message.y) : message.y;
                if (message.hp != null && Object.hasOwnProperty.call(message, "hp"))
                    object.hp = message.hp;
                if (message.maxHp != null && Object.hasOwnProperty.call(message, "maxHp"))
                    object.maxHp = message.maxHp;
                if (message.facing != null && Object.hasOwnProperty.call(message, "facing"))
                    object.facing = message.facing;
                if (message.moving != null && Object.hasOwnProperty.call(message, "moving"))
                    object.moving = message.moving;
                if (message.attacking != null && Object.hasOwnProperty.call(message, "attacking"))
                    object.attacking = message.attacking;
                if (message.dead != null && Object.hasOwnProperty.call(message, "dead"))
                    object.dead = message.dead;
                if (message.lastAttackElapsedMs != null && Object.hasOwnProperty.call(message, "lastAttackElapsedMs"))
                    object.lastAttackElapsedMs = options.json && !isFinite(message.lastAttackElapsedMs) ? String(message.lastAttackElapsedMs) : message.lastAttackElapsedMs;
                if (message.lastContactElapsedMs != null && Object.hasOwnProperty.call(message, "lastContactElapsedMs"))
                    object.lastContactElapsedMs = options.json && !isFinite(message.lastContactElapsedMs) ? String(message.lastContactElapsedMs) : message.lastContactElapsedMs;
                let keys2;
                if (message.skillCooldownRemainingMs && (keys2 = Object.keys(message.skillCooldownRemainingMs)).length) {
                    object.skillCooldownRemainingMs = {};
                    for (let j = 0; j < keys2.length; ++j) {
                        if (keys2[j] === "__proto__")
                            $util.makeProp(object.skillCooldownRemainingMs, keys2[j]);
                        object.skillCooldownRemainingMs[keys2[j]] = options.json && !isFinite(message.skillCooldownRemainingMs[keys2[j]]) ? String(message.skillCooldownRemainingMs[keys2[j]]) : message.skillCooldownRemainingMs[keys2[j]];
                    }
                }
                if (message.hasteRemainingMs != null && Object.hasOwnProperty.call(message, "hasteRemainingMs"))
                    object.hasteRemainingMs = options.json && !isFinite(message.hasteRemainingMs) ? String(message.hasteRemainingMs) : message.hasteRemainingMs;
                if (message.healthPotions != null && Object.hasOwnProperty.call(message, "healthPotions"))
                    object.healthPotions = message.healthPotions;
                if (message.stateJson != null && Object.hasOwnProperty.call(message, "stateJson"))
                    object.stateJson = message.stateJson;
                return object;
            };

            /**
             * Converts this DungeonSnapshot to JSON.
             * @function toJSON
             * @memberof arcade.dungeon.DungeonSnapshot
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            DungeonSnapshot.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for DungeonSnapshot
             * @function getTypeUrl
             * @memberof arcade.dungeon.DungeonSnapshot
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            DungeonSnapshot.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/arcade.dungeon.DungeonSnapshot";
            };

            return DungeonSnapshot;
        })();

        dungeon.DungeonSnapshotRequest = (function() {

            /**
             * Properties of a DungeonSnapshotRequest.
             * @memberof arcade.dungeon
             * @interface IDungeonSnapshotRequest
             * @property {string|null} [roomId] DungeonSnapshotRequest roomId
             * @property {arcade.dungeon.IDungeonSnapshot|null} [snapshot] DungeonSnapshotRequest snapshot
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
             * @member {arcade.dungeon.IDungeonSnapshot|null|undefined} snapshot
             * @memberof arcade.dungeon.DungeonSnapshotRequest
             * @instance
             */
            DungeonSnapshotRequest.prototype.snapshot = null;

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
                    $root.arcade.dungeon.DungeonSnapshot.encode(message.snapshot, writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
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
                            message.snapshot = $root.arcade.dungeon.DungeonSnapshot.decode(reader, reader.uint32(), undefined, long + 1);
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
                    let error = $root.arcade.dungeon.DungeonSnapshot.verify(message.snapshot, long + 1);
                    if (error)
                        return "snapshot." + error;
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
                    message.snapshot = $root.arcade.dungeon.DungeonSnapshot.fromObject(object.snapshot, long + 1);
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
                }
                if (message.roomId != null && Object.hasOwnProperty.call(message, "roomId"))
                    object.roomId = message.roomId;
                if (message.snapshot != null && Object.hasOwnProperty.call(message, "snapshot"))
                    object.snapshot = $root.arcade.dungeon.DungeonSnapshot.toObject(message.snapshot, options, q + 1);
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
             * @property {arcade.dungeon.IDungeonSnapshot|null} [snapshot] DungeonSnapshotRelay snapshot
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
             * @member {arcade.dungeon.IDungeonSnapshot|null|undefined} snapshot
             * @memberof arcade.dungeon.DungeonSnapshotRelay
             * @instance
             */
            DungeonSnapshotRelay.prototype.snapshot = null;

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
                    $root.arcade.dungeon.DungeonSnapshot.encode(message.snapshot, writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
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
                            message.snapshot = $root.arcade.dungeon.DungeonSnapshot.decode(reader, reader.uint32(), undefined, long + 1);
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
                    let error = $root.arcade.dungeon.DungeonSnapshot.verify(message.snapshot, long + 1);
                    if (error)
                        return "snapshot." + error;
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
                    message.snapshot = $root.arcade.dungeon.DungeonSnapshot.fromObject(object.snapshot, long + 1);
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
                }
                if (message.playerId != null && Object.hasOwnProperty.call(message, "playerId"))
                    object.playerId = message.playerId;
                if (message.snapshot != null && Object.hasOwnProperty.call(message, "snapshot"))
                    object.snapshot = $root.arcade.dungeon.DungeonSnapshot.toObject(message.snapshot, options, q + 1);
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
