var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
var preload_file_1 = require("../generic/preload_file");
var file_system_1 = require("../core/file_system");
var node_fs_stats_1 = require("../core/node_fs_stats");
var api_error_1 = require("../core/api_error");
var async_1 = require("async");
var path = require("path");
var util_1 = require("../core/util");
/* tslint:disable:member-ordering */
/* tslint:disable:one-line */
/* tslint:disable:triple-equals */
/**
 * @hidden
 */
var errorCodeLookup;
/**
 * Lazily construct error code lookup, since DropboxJS might be loaded *after* BrowserFS (or not at all!)
 * @hidden
 */
function constructErrorCodeLookup() {
    if (errorCodeLookup) {
        return;
    }
    errorCodeLookup = {};
    errorCodeLookup[Errors.GENERAL_FAILURE] = api_error_1.ErrorCode.EIO;
    errorCodeLookup[Errors.CREATION_ERROR] = api_error_1.ErrorCode.EIO;
    errorCodeLookup[Errors.WRITE_ERROR] = api_error_1.ErrorCode.EIO;
    errorCodeLookup[Errors.IS_DIR] = api_error_1.ErrorCode.EISDIR;
    errorCodeLookup[Errors.IS_FILE] = api_error_1.ErrorCode.ENOTDIR;
    errorCodeLookup[Errors.NO_INPUT] = api_error_1.ErrorCode.EINVAL;
    errorCodeLookup[Errors.OPEN_ERROR] = api_error_1.ErrorCode.EIO;
    errorCodeLookup[Errors.OUT_OF_FS] = api_error_1.ErrorCode.EPERM;
}
// /**
//  * @hidden
//  */
// function isDirInfo(cache: ICachedPathInfo): cache is ICachedDirInfo {
//   return cache && cache.stat.isFolder;
// }
var parseOptions = function (input) {
    var full = {};
    var inputSplit = input.split("\n");
    for (var _i = 0, inputSplit_1 = inputSplit; _i < inputSplit_1.length; _i++) {
        var element = inputSplit_1[_i];
        if (element.includes("=\"")) {
            var optVal = element.slice(element.indexOf("=") + 1).slice(1).slice(0, -1);
            var booleanValue = (optVal === "true" || optVal === "false") ? optVal === "true" : undefined;
            var optKey = element.split("=")[0];
            full[optKey] = (booleanValue === undefined ? optVal : booleanValue);
        }
    }
    return full;
};
;
/**
 * @hidden
 */
function isArrayBuffer(ab) {
    // Accept null / undefined, too.
    return ab === null || ab === undefined || (typeof (ab) === 'object' && typeof (ab['byteLength']) === 'number');
}
var Errors = {
    GENERAL_FAILURE: "Meta call failed",
    IS_FILE: "Is a file",
    IS_DIR: "Is a dir",
    NO_INPUT: "No input",
    OUT_OF_FS: "Out of scope",
    WRITE_ERROR: "Write error",
    OPEN_ERROR: "Open error",
    CREATION_ERROR: "File didn't exist, creation caused errors",
    OK: "OK"
};
/**
 * Wraps a Dropbox client and caches operations.
 * @hidden
 */
var RealFSClient = (function () {
    function RealFSClient(apiUrl) {
        this._cache = {};
        // this._client = client;
        this._apiUrl = apiUrl;
    }
    RealFSClient.prototype._makeRequest = function (kind, filePath, callback, postData) {
        var constructedFullApiUrl = [
            this._apiUrl,
        ];
        var targetMethod = "";
        // const dataToPost = [];
        var search = [];
        var appendPath = function (path) { return search.push({ key: "path", value: encodeURIComponent(path) }); };
        switch (kind) {
            case "read":
                constructedFullApiUrl.push("file");
                targetMethod = "GET";
                appendPath(filePath);
                break;
            case "list":
                constructedFullApiUrl.push("directory");
                targetMethod = "GET";
                appendPath(filePath);
                break;
            case "stat":
                constructedFullApiUrl.push("stat");
                targetMethod = "GET";
                appendPath(filePath);
                break;
            case "write":
                constructedFullApiUrl.push("file");
                targetMethod = "POST";
                appendPath(filePath);
                break;
            default:
                throw new Error("Unknown operation requested " + kind);
        }
        var req = fetch(constructedFullApiUrl.join("/") + (search.length > 0 ? "?" + search.map(function (x) { return x.key + "=" + x.value; }).join("&") : ""), {
            method: targetMethod,
            body: postData
        });
        req["catch"](function (x) {
            callback(x);
        });
        req.then(function (x) {
            callback(null, x);
        });
    };
    RealFSClient.prototype.readdir = function (p, cb) {
        /*
            const cacheInfo = this.getCachedDirInfo(p);
    
            this._wrap((interceptCb) => {
              if (cacheInfo !== null && cacheInfo.contents) {
                this._client.readdir(p, {
                  contentHash: cacheInfo.stat.contentHash
                }, interceptCb);
              } else {
                this._client.readdir(p, interceptCb);
              }
            }, (err: Dropbox.ApiError, filenames: string[], stat: Dropbox.File.Stat, folderEntries: Dropbox.File.Stat[]) => {
              if (err) {
                if (err.status === Dropbox.ApiError.NO_CONTENT && cacheInfo !== null) {
                  cb(null, cacheInfo.contents.slice(0));
                } else {
                  cb(err);
                }
              } else {
                this.updateCachedDirInfo(p, stat, filenames.slice(0));
                folderEntries.forEach((entry) => {
                  this.updateCachedInfo(path.join(p, entry.name), entry);
                });
                cb(null, filenames);
              }
            });
        */
        this._makeRequest("list", p, function (err, contents) {
            if (err) {
                cb(err);
            }
            else {
                if (contents == undefined) {
                    return;
                }
                if (contents.status != 200) {
                    var convertErrorMsg = function (errorMsg) { return new Error(errorMsg); };
                    switch (contents.statusText) {
                        case Errors.IS_FILE:
                            cb(convertErrorMsg("IS_FILE"));
                            break;
                        case Errors.OUT_OF_FS:
                            cb(convertErrorMsg("OUT_OF_FS"));
                            break;
                        case Errors.GENERAL_FAILURE:
                            cb(convertErrorMsg("GENERAL_FAILURE"));
                            break;
                        default:
                            break;
                    }
                    return;
                }
                else {
                    // cb(null, (await contents.text()).split("\n"));
                    contents.text().then(function (x2) {
                        cb(null, x2.split("\n").filter(function (x) { return x.length > 0; }));
                    });
                }
            }
        });
    };
    RealFSClient.prototype.remove = function (p, cb) {
        // this._wrap((interceptCb) => {
        //   this._client.remove(p, interceptCb);
        // }, (err: Dropbox.ApiError, stat?: Dropbox.File.Stat) => {
        //   if (!err) {
        //     this.updateCachedInfo(p, stat!);
        //   }
        //   cb(err);
        // });
        cb(new Error("Unimplemented"));
    };
    RealFSClient.prototype.move = function (src, dest, cb) {
        // this._wrap((interceptCb) => {
        //   this._client.move(src, dest, interceptCb);
        // }, (err: Dropbox.ApiError, stat: Dropbox.File.Stat) => {
        //   if (!err) {
        //     this.deleteCachedInfo(src);
        //     this.updateCachedInfo(dest, stat);
        //   }
        //   cb(err);
        // });
        cb(new Error("Unimplemented"));
    };
    RealFSClient.prototype.stat = function (p, cb) {
        // this._wrap((interceptCb) => {
        //   this._client.stat(p, interceptCb);
        // }, (err: Dropbox.ApiError, stat: Dropbox.File.Stat) => {
        //   if (!err) {
        //     this.updateCachedInfo(p, stat);
        //   }
        //   cb(err, stat);
        // });
        // cb(new Error("Unimplemented"));
        this._makeRequest("stat", p, function (err, contents) {
            if (err) {
                cb(err);
            }
            else {
                if (contents == undefined) {
                    return;
                }
                if (contents.status != 200) {
                    var convertErrorMsg = function (errorMsg) { return new Error(errorMsg); };
                    switch (contents.statusText) {
                        case Errors.OUT_OF_FS:
                            cb(convertErrorMsg("OUT_OF_FS"));
                            break;
                        case Errors.GENERAL_FAILURE:
                            cb(convertErrorMsg("GENERAL_FAILURE"));
                            break;
                        default:
                            break;
                    }
                    return;
                }
                else {
                    contents.text().then(function (x2) {
                        cb(null, parseOptions(x2));
                    });
                }
            }
        });
    };
    RealFSClient.prototype.readFile = function (p, cb) {
        var _this = this;
        // const cacheInfo = this.getCachedFileInfo(p);
        // if (cacheInfo !== null && cacheInfo.contents !== null) {
        //   // Try to use cached info; issue a stat to see if contents are up-to-date.
        //   this.stat(p, (error, stat?) => {
        //     if (error) {
        //       cb(error);
        //     } else if (stat!.contentHash === cacheInfo!.stat.contentHash) {
        //       // No file changes.
        //       cb(error, cacheInfo!.contents.slice(0), cacheInfo!.stat);
        //     } else {
        //       // File changes; rerun to trigger actual readFile.
        //       this.readFile(p, cb);
        //     }
        //   });
        // } else {
        //   this._wrap((interceptCb) => {
        //     this._client.readFile(p, { arrayBuffer: true }, interceptCb);
        //   }, (err: Dropbox.ApiError, contents: any, stat: Dropbox.File.Stat) => {
        //     if (!err) {
        //       this.updateCachedInfo(p, stat, contents.slice(0));
        //     }
        //     cb(err, contents, stat);
        //   });
        // }
        // cb(new Error("Unimplemented"));
        this._makeRequest("read", p, function (err, contents) {
            if (err) {
                cb(err);
            }
            else {
                if (contents == undefined) {
                    return;
                }
                if (contents.status != 200) {
                    var convertErrorMsg = function (errorMsg) { return new Error(errorMsg); };
                    switch (contents.statusText) {
                        case Errors.OUT_OF_FS:
                            cb(convertErrorMsg("OUT_OF_FS"));
                            break;
                        case Errors.GENERAL_FAILURE:
                            cb(convertErrorMsg("GENERAL_FAILURE"));
                            break;
                        default:
                            break;
                    }
                    return;
                }
                else {
                    contents.arrayBuffer().then(function (x2) {
                        // cb(null, x2, );
                        _this.stat(p, function (err, stat) {
                            cb(err, x2, stat);
                        });
                    });
                }
            }
        });
    };
    RealFSClient.prototype.writeFile = function (p, contents, cb) {
        var _this = this;
        // this._wrap((interceptCb) => {
        //   this._client.writeFile(p, contents, interceptCb);
        // }, (err: Dropbox.ApiError, stat: Dropbox.File.Stat) => {
        //   if (!err) {
        //     this.updateCachedInfo(p, stat, contents.slice(0));
        //   }
        //   cb(err, stat);
        // });
        // cb(new Error("Unimplemented"));
        this._makeRequest("write", p, function (err, contents) {
            if (err) {
                cb(err);
            }
            else {
                if (contents == undefined) {
                    return;
                }
                if (contents.status != 200) {
                    var convertErrorMsg = function (errorMsg) { return new Error(errorMsg); };
                    switch (contents.statusText) {
                        case Errors.OPEN_ERROR:
                            cb(convertErrorMsg("OPEN_ERROR"));
                            break;
                        case Errors.WRITE_ERROR:
                            cb(convertErrorMsg("WRITE_ERROR"));
                            break;
                        case Errors.CREATION_ERROR:
                            cb(convertErrorMsg("CREATION_ERROR"));
                            break;
                        case Errors.OUT_OF_FS:
                            cb(convertErrorMsg("OUT_OF_FS"));
                            break;
                        case Errors.GENERAL_FAILURE:
                            cb(convertErrorMsg("GENERAL_FAILURE"));
                            break;
                        default:
                            break;
                    }
                    return;
                }
                else {
                    _this.stat(p, function (err, stat) {
                        cb(err, stat);
                    });
                }
            }
        }, contents);
    };
    RealFSClient.prototype.mkdir = function (p, cb) {
        var _this = this;
        this._wrap(function (interceptCb) {
            _this._client.mkdir(p, interceptCb);
        }, function (err, stat) {
            if (!err) {
                _this.updateCachedInfo(p, stat, []);
            }
            cb(err);
        });
    };
    /**
     * Wraps an operation such that we retry a failed operation 3 times.
     * Necessary to deal with Dropbox rate limiting.
     *
     * @param performOp Function that performs the operation. Will be called up to three times.
     * @param cb Called when the operation succeeds, fails in a non-temporary manner, or fails three times.
     */
    RealFSClient.prototype._wrap = function (performOp, cb) {
        var numRun = 0;
        var interceptCb = function (error) {
            // Timeout duration, in seconds.
            var timeoutDuration = 2;
            if (error && 3 > (++numRun)) {
                switch (error.status) {
                    case Dropbox.ApiError.SERVER_ERROR:
                    case Dropbox.ApiError.NETWORK_ERROR:
                    case Dropbox.ApiError.RATE_LIMITED:
                        setTimeout(function () {
                            performOp(interceptCb);
                        }, timeoutDuration * 1000);
                        break;
                    default:
                        cb.apply(null, arguments);
                        break;
                }
            }
            else {
                cb.apply(null, arguments);
            }
        };
        performOp(interceptCb);
    };
    RealFSClient.prototype.getCachedInfo = function (p) {
        return this._cache[p.toLowerCase()];
    };
    RealFSClient.prototype.putCachedInfo = function (p, cache) {
        this._cache[p.toLowerCase()] = cache;
    };
    // private deleteCachedInfo(p: string): void {
    //   delete this._cache[p.toLowerCase()];
    // }
    // private getCachedDirInfo(p: string): ICachedDirInfo | null {
    //   const info = this.getCachedInfo(p);
    //   if (isDirInfo(info)) {
    //     return info;
    //   } else {
    //     return null;
    //   }
    // }
    // private getCachedFileInfo(p: string): ICachedFileInfo | null {
    //   const info = this.getCachedInfo(p);
    //   if (isFileInfo(info)) {
    //     return info;
    //   } else {
    //     return null;
    //   }
    // }
    RealFSClient.prototype.updateCachedDirInfo = function (p, stat, contents) {
        if (contents === void 0) { contents = null; }
        var cachedInfo = this.getCachedInfo(p);
        // Dropbox uses the *contentHash* property for directories.
        // Ignore stat objects w/o a contentHash defined; those actually exist!!!
        // (Example: readdir returns an array of stat objs; stat objs for dirs in that context have no contentHash)
        if (stat.contentHash !== null && (cachedInfo === undefined || cachedInfo.stat.contentHash !== stat.contentHash)) {
            this.putCachedInfo(p, {
                stat: stat,
                contents: contents
            });
        }
    };
    // "dist": "npm-run-all build lint script:make_dist dist:build:node",
    RealFSClient.prototype.updateCachedFileInfo = function (p, stat, contents) {
        if (contents === void 0) { contents = null; }
        var cachedInfo = this.getCachedInfo(p);
        // Dropbox uses the *versionTag* property for files.
        // Ignore stat objects w/o a versionTag defined.
        if (stat.versionTag !== null && (cachedInfo === undefined || cachedInfo.stat.versionTag !== stat.versionTag)) {
            this.putCachedInfo(p, {
                stat: stat,
                contents: contents
            });
        }
    };
    RealFSClient.prototype.updateCachedInfo = function (p, stat, contents) {
        if (contents === void 0) { contents = null; }
        if (stat.isFile && isArrayBuffer(contents)) {
            this.updateCachedFileInfo(p, stat, contents);
        }
        else if (stat.isFolder && Array.isArray(contents)) {
            this.updateCachedDirInfo(p, stat, contents);
        }
    };
    return RealFSClient;
}());
// "build": "npm-run-all --parallel build:tsc build:scripts --sequential build:rollup --parallel build:webpack build:webpack-release",
var RealFile = (function (_super) {
    __extends(RealFile, _super);
    function RealFile(_fs, _path, _flag, _stat, contents) {
        return _super.call(this, _fs, _path, _flag, _stat, contents) || this;
    }
    RealFile.prototype.sync = function (cb) {
        var _this = this;
        if (this.isDirty()) {
            var buffer = this.getBuffer(), arrayBuffer = util_1.buffer2ArrayBuffer(buffer);
            this._fs._writeFileStrict(this.getPath(), arrayBuffer, function (e) {
                if (!e) {
                    _this.resetDirty();
                }
                cb(e);
            });
        }
        else {
            cb();
        }
    };
    RealFile.prototype.close = function (cb) {
        this.sync(cb);
    };
    return RealFile;
}(preload_file_1["default"]));
exports.RealFile = RealFile;
/**
 * A read/write file system backed by Dropbox cloud storage.
 *
 * Uses the Dropbox V1 API.
 *
 * NOTE: You must use the v0.10 version of the [Dropbox JavaScript SDK](https://www.npmjs.com/package/dropbox).
 */
var RealFileSystem = (function (_super) {
    __extends(RealFileSystem, _super);
    /**
     * **Deprecated. Please use Dropbox.Create() method instead.**
     *
     * Constructs a Dropbox-backed file system using the *authenticated* DropboxJS client.
     *
     * Note that you must use the old v0.10 version of the Dropbox JavaScript SDK.
     */
    function RealFileSystem(apiUrl, deprecateMsg) {
        if (deprecateMsg === void 0) { deprecateMsg = true; }
        var _this = _super.call(this) || this;
        _this._client = new RealFSClient(apiUrl);
        util_1.deprecationMessage(deprecateMsg, RealFileSystem.Name, { client: "authenticated dropbox client instance" });
        constructErrorCodeLookup();
        return _this;
    }
    /**
     * Creates a new DropboxFileSystem instance with the given options.
     * Must be given an *authenticated* DropboxJS client from the old v0.10 version of the Dropbox JS SDK.
     */
    RealFileSystem.Create = function (opts, cb) {
        cb(null, new RealFileSystem(opts.apiUrl, false));
    };
    RealFileSystem.isAvailable = function () {
        // Checks if the Dropbox library is loaded.
        return typeof Dropbox !== 'undefined';
    };
    RealFileSystem.prototype.getName = function () {
        return RealFileSystem.Name;
    };
    RealFileSystem.prototype.isReadOnly = function () {
        return false;
    };
    // Dropbox doesn't support symlinks, properties, or synchronous calls
    RealFileSystem.prototype.supportsSymlinks = function () {
        return false;
    };
    RealFileSystem.prototype.supportsProps = function () {
        return false;
    };
    RealFileSystem.prototype.supportsSynch = function () {
        return false;
    };
    RealFileSystem.prototype.empty = function (mainCb) {
        var _this = this;
        this._client.readdir('/', function (error, files) {
            if (error) {
                mainCb(_this.convert(error.message, '/'));
            }
            else {
                var deleteFile = function (file, cb) {
                    var p = path.join('/', file);
                    _this._client.remove(p, function (err) {
                        cb(err ? _this.convert(err.message, p) : null);
                    });
                };
                var finished = function (err) {
                    if (err) {
                        mainCb(err);
                    }
                    else {
                        mainCb();
                    }
                };
                // XXX: <any> typing is to get around overly-restrictive ErrorCallback typing.
                async_1.each(files, deleteFile, finished);
            }
        });
    };
    RealFileSystem.prototype.rename = function (oldPath, newPath, cb) {
        // this._client.move(oldPath, newPath, (error) => {
        //   if (error) {
        //     // the move is permitted if newPath is a file.
        //     // Check if this is the case, and remove if so.
        //     this._client.stat(newPath, (error2, stat) => {
        //       if (error2 || stat!.isFolder) {
        //         const missingPath = (<any>error.response).error.indexOf(oldPath) > -1 ? oldPath : newPath;
        //         cb(this.convert(error, missingPath));
        //       } else {
        //         // Delete file, repeat rename.
        //         this._client.remove(newPath, (error2) => {
        //           if (error2) {
        //             cb(this.convert(error2, newPath));
        //           } else {
        //             this.rename(oldPath, newPath, cb);
        //           }
        //         });
        //       }
        //     });
        //   } else {
        //     cb();
        //   }
        // });
        cb(this.convert(Errors.GENERAL_FAILURE));
    };
    RealFileSystem.prototype.stat = function (path, isLstat, cb) {
        var _this = this;
        // Ignore lstat case -- Dropbox doesn't support symlinks
        // Stat the file
        this._client.stat(path, function (error, stat) {
            if (error) {
                cb(_this.convert(error.message, path));
                // } else if (stat && stat.isRemoved) {
                //   // Dropbox keeps track of deleted files, so if a file has existed in the
                //   // past but doesn't any longer, you wont get an error
                //   cb(ApiError.FileError(ErrorCode.ENOENT, path));
            }
            else {
                var stats = new node_fs_stats_1["default"](_this._statType(stat), parseInt(stat.size, 10), parseInt(stat.mode, 10), new Date(parseInt(stat.atime, 10) * 1000), new Date(parseInt(stat.atime, 10) * 1000), new Date(parseInt(stat.ctime, 10) * 1000));
                return cb(null, stats);
            }
        });
    };
    RealFileSystem.prototype.open = function (path, flags, mode, cb) {
        var _this = this;
        // Try and get the file's contents
        this._client.readFile(path, function (error, content, dbStat) {
            if (error) {
                // If the file's being opened for reading and doesn't exist, return an
                // error
                if (flags.isReadable()) {
                    cb(_this.convert(error.message, path));
                }
                else {
                    switch (error.message) {
                        // If it's being opened for writing or appending, create it so that
                        // it can be written to
                        case "GENERAL_FAILURE":
                            var ab_1 = new ArrayBuffer(0);
                            return _this._writeFileStrict(path, ab_1, function (error2, stat) {
                                if (error2) {
                                    cb(error2);
                                }
                                else {
                                    var file = _this._makeFile(path, flags, stat, util_1.arrayBuffer2Buffer(ab_1));
                                    cb(null, file);
                                }
                            });
                        default:
                            return cb(_this.convert(error.message, path));
                    }
                }
            }
            else {
                // No error
                var buffer = void 0;
                // Dropbox.js seems to set `content` to `null` rather than to an empty
                // buffer when reading an empty file. Not sure why this is.
                if (content === null) {
                    buffer = util_1.emptyBuffer();
                }
                else {
                    buffer = util_1.arrayBuffer2Buffer(content);
                }
                var file = _this._makeFile(path, flags, dbStat, buffer);
                return cb(null, file);
            }
        });
    };
    RealFileSystem.prototype._writeFileStrict = function (p, data, cb) {
        var _this = this;
        var parent = path.dirname(p);
        this.stat(parent, false, function (error, stat) {
            if (error) {
                cb(api_error_1.ApiError.FileError(api_error_1.ErrorCode.ENOENT, parent));
            }
            else {
                _this._client.writeFile(p, data, function (error2, stat) {
                    if (error2) {
                        cb(_this.convert(error2.message, p));
                    }
                    else {
                        cb(null, stat);
                    }
                });
            }
        });
    };
    /**
     * Private
     * Returns a BrowserFS object representing the type of a Dropbox.js stat object
     */
    RealFileSystem.prototype._statType = function (stat) {
        return parseInt(stat.itemType, 10);
    };
    /**
     * Private
     * Returns a BrowserFS object representing a File, created from the data
     * returned by calls to the Dropbox API.
     */
    RealFileSystem.prototype._makeFile = function (path, flag, stat, buffer) {
        // const type = /*this._statType(stat); TODO*/ FileType.FILE;
        var type = this._statType(stat);
        var stats = new node_fs_stats_1["default"](type, parseInt(stat.size, 10));
        return new RealFile(this, path, flag, stats, buffer);
    };
    /**
     * Private
     * Delete a file or directory from Dropbox
     * isFile should reflect which call was made to remove the it (`unlink` or
     * `rmdir`). If this doesn't match what's actually at `path`, an error will be
     * returned
     */
    RealFileSystem.prototype._remove = function (path, cb, isFile) {
        var _this = this;
        this._client.stat(path, function (error, stat) {
            if (error) {
                cb(_this.convert(error.message, path));
            }
            else {
                if (_this._statType(stat) == node_fs_stats_1.FileType.FILE && !isFile) {
                    cb(api_error_1.ApiError.FileError(api_error_1.ErrorCode.ENOTDIR, path));
                }
                else if (!(_this._statType(stat) == node_fs_stats_1.FileType.FILE) && isFile) {
                    cb(api_error_1.ApiError.FileError(api_error_1.ErrorCode.EISDIR, path));
                }
                else {
                    _this._client.remove(path, function (error) {
                        if (error) {
                            cb(_this.convert(error.message, path));
                        }
                        else {
                            cb(null);
                        }
                    });
                }
            }
        });
    };
    /**
     * Delete a file
     */
    RealFileSystem.prototype.unlink = function (path, cb) {
        this._remove(path, cb, true);
    };
    /**
     * Delete a directory
     */
    RealFileSystem.prototype.rmdir = function (path, cb) {
        this._remove(path, cb, false);
    };
    /**
     * Create a directory
     */
    RealFileSystem.prototype.mkdir = function (p, mode, cb) {
        var _this = this;
        // Dropbox.js' client.mkdir() behaves like `mkdir -p`, i.e. it creates a
        // directory and all its ancestors if they don't exist.
        // Node's fs.mkdir() behaves like `mkdir`, i.e. it throws an error if an attempt
        // is made to create a directory without a parent.
        // To handle this inconsistency, a check for the existence of `path`'s parent
        // must be performed before it is created, and an error thrown if it does
        // not exist
        var parent = path.dirname(p);
        this._client.stat(parent, function (error, stat) {
            if (error) {
                cb(_this.convert(error.message, parent));
            }
            else {
                _this._client.mkdir(p, function (error) {
                    if (error) {
                        cb(api_error_1.ApiError.FileError(api_error_1.ErrorCode.EEXIST, p));
                    }
                    else {
                        cb(null);
                    }
                });
            }
        });
    };
    /**
     * Get the names of the files in a directory
     */
    RealFileSystem.prototype.readdir = function (path, cb) {
        var _this = this;
        this._client.readdir(path, function (error, files) {
            if (error) {
                return cb(_this.convert(error.message));
            }
            else {
                return cb(null, files);
            }
        });
    };
    /**
     * Converts a Dropbox-JS error into a BFS error.
     */
    RealFileSystem.prototype.convert = function (err, path) {
        if (path === void 0) { path = null; }
        var errorCode = errorCodeLookup[err];
        if (errorCode === undefined) {
            errorCode = api_error_1.ErrorCode.EIO;
        }
        if (!path) {
            return new api_error_1.ApiError(errorCode);
        }
        else {
            return api_error_1.ApiError.FileError(errorCode, path);
        }
    };
    return RealFileSystem;
}(file_system_1.BaseFileSystem));
RealFileSystem.Name = "Dropbox";
RealFileSystem.Options = {
    // client: {
    //   type: "object",
    //   description: "An *authenticated* Dropbox client. Must be from the 0.10 JS SDK.",
    //   validator: (opt: Dropbox.Client, cb: BFSOneArgCallback): void => {
    //     if (opt.isAuthenticated && opt.isAuthenticated()) {
    //       cb();
    //     } else {
    //       cb(new ApiError(ErrorCode.EINVAL, `'client' option must be an authenticated Dropbox client from the v0.10 JS SDK.`));
    //     }
    //   }
    // }
    apiUrl: {
        type: "string",
        description: "API endpoint that contains the RealFS server"
    }
};
exports["default"] = RealFileSystem;
//# sourceMappingURL=RealFS.js.map