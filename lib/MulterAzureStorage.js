"use strict";
// *********************************************************
//
// This file is subject to the terms and conditions defined in
// file 'LICENSE.txt', which is part of this source code package.
//
// *********************************************************
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MulterAzureStorage = exports.MASError = void 0;
// Node Modules
var uuid_1 = require("uuid");
var path_1 = require("path");
var storage_blob_1 = require("@azure/storage-blob");
// Custom error class
var MASError = /** @class */ (function () {
    function MASError(message) {
        this.errorList = [];
        this.name = "Multer Azure Error";
        this.message = message ? message : null;
    }
    return MASError;
}());
exports.MASError = MASError;
var MulterAzureStorage = /** @class */ (function () {
    function MulterAzureStorage(options) {
        var _a, _b;
        this.DEFAULT_UPLOAD_CONTAINER = "default-container";
        this.DEFAULT_CONTAINER_ACCESS_LEVEL = undefined;
        // Init error array
        var errorLength = 0;
        this._error = new MASError();
        // Connection is preferred.
        options.connectionString =
            options.connectionString ||
                process.env.AZURE_STORAGE_CONNECTION_STRING ||
                null;
        if (!options.connectionString) {
            options.accessKey =
                options.accessKey || process.env.AZURE_STORAGE_ACCESS_KEY || null;
            options.accountName =
                options.accountName || process.env.AZURE_STORAGE_ACCOUNT || null;
            // Access key is required if no connection string is provided
            if (!options.accessKey) {
                errorLength++;
                this._error.errorList.push(new Error("Missing required parameter: Azure blob storage access key."));
            }
            // Account name is required if no connection string is provided
            if (!options.accountName) {
                errorLength++;
                this._error.errorList.push(new Error("Missing required parameter: Azure blob storage account name."));
            }
        }
        // Container name is required
        if (!options.containerName) {
            errorLength++;
            this._error.errorList.push(new Error("Missing required parameter: Azure container name."));
        }
        // Validate errors before proceeding
        if (errorLength > 0) {
            var inflection = errorLength > 1 ? ["are", "s"] : ["is", ""];
            this._error.message = "There ".concat(inflection[0], " ").concat(errorLength, " missing required parameter").concat(inflection[1], ".");
            throw this._error;
        }
        // Set proper container name
        switch (typeof options.containerName) {
            case "string":
                this._containerName = this._promisifyStaticValue(options.containerName);
                break;
            case "function":
                this._containerName = options.containerName;
                break;
            default:
                // Catch for if container name is provided but not a desired type
                this._containerName = this._promisifyStaticValue(this.DEFAULT_UPLOAD_CONTAINER);
                break;
        }
        // Set container access level
        if (!options.containerAccessLevel ||
            options.containerAccessLevel === "off") {
            this._containerAccessLevel = this.DEFAULT_CONTAINER_ACCESS_LEVEL;
        }
        else {
            this._containerAccessLevel = options.containerAccessLevel;
        }
        // Check for metadata
        if (!options.metadata) {
            this._metadata = null;
        }
        else {
            switch (typeof options.metadata) {
                case "object":
                    this._metadata = this._promisifyStaticObj(options.metadata);
                    break;
                case "function":
                    this._metadata = options.metadata;
                    break;
                default:
                    // Nullify all other types
                    this._metadata = null;
                    break;
            }
        }
        // Set proper blob name
        this._blobName = options.blobName
            ? options.blobName
            : this._generateBlobName;
        // Set buffer settings
        this._bufferSize = 1024 * 1024 * ((_a = options.bufferSizeInMB) !== null && _a !== void 0 ? _a : 4);
        this._maxBufferCount = (_b = options.maxBufferCount) !== null && _b !== void 0 ? _b : 20;
        // Init blob service
        this._blobService = options.connectionString
            ? storage_blob_1.BlobServiceClient.fromConnectionString(options.connectionString)
            : new storage_blob_1.BlobServiceClient("https://".concat(options.accountName, ".blob.core.windows.net"), new storage_blob_1.StorageSharedKeyCredential(options.accountName, options.accessKey));
    }
    MulterAzureStorage.prototype._handleFile = function (req, file, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cb) {
        return __awaiter(this, void 0, void 0, function () {
            var blobName, containerName, _a, _b, _c, properties, fileToReturn, hFError_1;
            var _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        // Ensure we have no errors during setup
                        if (this._error.errorList.length > 0) {
                            cb(this._error);
                        }
                        else {
                            // All good. Continue...
                        }
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 8, , 9]);
                        return [4 /*yield*/, this._blobName(req, file)];
                    case 2:
                        blobName = _e.sent();
                        return [4 /*yield*/, this._containerName(req, file)];
                    case 3:
                        containerName = _e.sent();
                        // Create container if it doesn't exist
                        return [4 /*yield*/, this._createContainerIfNotExists(containerName, this._containerAccessLevel)];
                    case 4:
                        // Create container if it doesn't exist
                        _e.sent();
                        _b = (_a = this._blobService
                            .getContainerClient(containerName)
                            .getBlockBlobClient(blobName))
                            .uploadStream;
                        _c = [file.stream, this._bufferSize, this._maxBufferCount];
                        _d = {};
                        return [4 /*yield*/, this._metadata(req, file)];
                    case 5: 
                    // Upload away
                    return [4 /*yield*/, _b.apply(_a, _c.concat([(_d.metadata = (_e.sent()),
                                _d.blobHTTPHeaders = { blobContentType: file.mimetype },
                                _d)]))];
                    case 6:
                        // Upload away
                        _e.sent();
                        return [4 /*yield*/, this._getBlobProperties(containerName, blobName)];
                    case 7:
                        properties = _e.sent();
                        fileToReturn = Object.assign({}, file, {
                            url: this._getUrl(containerName, blobName),
                            blobName: blobName,
                            containerName: containerName,
                            etag: properties.etag,
                            blobType: properties.blobType,
                            metadata: properties.metadata,
                            blobSize: properties.contentLength,
                        });
                        cb(null, fileToReturn);
                        return [3 /*break*/, 9];
                    case 8:
                        hFError_1 = _e.sent();
                        cb(hFError_1);
                        return [3 /*break*/, 9];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    MulterAzureStorage.prototype._removeFile = function (req, file, cb) {
        return __awaiter(this, void 0, void 0, function () {
            var containerName, exists, rFError_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Ensure we have no errors during setup
                        if (this._error.errorList.length > 0) {
                            cb(this._error);
                        }
                        else {
                            // All good. Continue...
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 7, , 8]);
                        return [4 /*yield*/, this._containerName(req, file)];
                    case 2:
                        containerName = _a.sent();
                        return [4 /*yield*/, this._doesContainerExists(containerName)];
                    case 3:
                        exists = _a.sent();
                        if (!!exists) return [3 /*break*/, 4];
                        this._error.message =
                            "Cannot use container. Check if provided options are correct.";
                        cb(this._error);
                        return [3 /*break*/, 6];
                    case 4: return [4 /*yield*/, this._deleteBlobIfExists(containerName, file.blobName)];
                    case 5:
                        _a.sent();
                        cb(null);
                        _a.label = 6;
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        rFError_1 = _a.sent();
                        cb(rFError_1);
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /** Helpers */
    MulterAzureStorage.prototype._doesContainerExists = function (containerName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._blobService.getContainerClient(containerName).exists()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MulterAzureStorage.prototype._createContainerIfNotExists = function (name, accessLevel) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._blobService
                            .getContainerClient(name)
                            .createIfNotExists({ access: accessLevel })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    MulterAzureStorage.prototype._getUrl = function (containerName, blobName) {
        return this._blobService
            .getContainerClient(containerName)
            .getBlobClient(blobName).url;
    };
    MulterAzureStorage.prototype._getBlobProperties = function (containerName, blobName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._blobService
                            .getContainerClient(containerName)
                            .getBlobClient(blobName)
                            .getProperties()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MulterAzureStorage.prototype._deleteBlobIfExists = function (containerName, blobName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._blobService
                            .getContainerClient(containerName)
                            .getBlobClient(blobName)
                            .deleteIfExists()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    MulterAzureStorage.prototype._generateBlobName = function (_req, file) {
        return Promise.resolve("".concat(Date.now(), "-").concat((0, uuid_1.v4)()).concat((0, path_1.extname)(file.originalname)));
    };
    MulterAzureStorage.prototype._promisifyStaticValue = function (value) {
        return function () {
            return Promise.resolve(value);
        };
    };
    MulterAzureStorage.prototype._promisifyStaticObj = function (value) {
        return function () {
            return Promise.resolve(value);
        };
    };
    return MulterAzureStorage;
}());
exports.MulterAzureStorage = MulterAzureStorage;
exports.default = MulterAzureStorage;
//# sourceMappingURL=MulterAzureStorage.js.map