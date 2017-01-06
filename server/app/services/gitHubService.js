/*
 Copyright [2016] [Relevance Lab]
 
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at
 
 http://www.apache.org/licenses/LICENSE-2.0
 
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

var logger = require('_pr/logger')(module);
var gitHubModel = require('_pr/model/github/github.js');
var appConfig = require('_pr/config');
var Cryptography = require('_pr/lib/utils/cryptography');
var fileUpload = require('_pr/model/file-upload/file-upload');
var nodeGit =  require('nodegit');
var promisify = require("promisify-node");
var fse = promisify(require("fs-extra"));

var gitGubService = module.exports = {};

gitGubService.checkIfGitHubExists = function checkIfGitHubExists(gitHubId, callback) {
    gitHubModel.getById(gitHubId, function (err, gitHub) {
        if (err) {
            var err = new Error('Internal server error');
            err.status = 500;
            return callback(err);
        } else if (!gitHub) {
            var err = new Error('Git-Hub not found');
            err.status = 404;
            return callback(err);
        } else {
            return callback(null, gitHub);
        }
    });
};


gitGubService.createGitHub = function createGitHub(gitHubObj, callback) {
    if(gitHubObj.repositoryType === 'Private' && gitHubObj.authenticationType === 'userName'){
        var cryptoConfig = appConfig.cryptoSettings;
        var cryptography = new Cryptography(cryptoConfig.algorithm, cryptoConfig.password);
        gitHubObj.repositoryPassword =  cryptography.encryptText(gitHubObj.repositoryPassword, cryptoConfig.encryptionEncoding,
            cryptoConfig.decryptionEncoding);
    }
    gitHubModel.createNew(gitHubObj, function (err, gitHub) {
        if (err && err.name === 'ValidationError') {
            var err = new Error('Bad Request');
            err.status = 400;
            callback(err);
        } else if (err) {
            var err = new Error('Internal Server Error');
            err.status = 500;
            callback(err);
        } else {
            callback(null, gitHub);
        }
    });
};

gitGubService.updateGitHub = function updateGitHub(gitHubId, gitHubObj, callback) {
    if(gitHubObj.repositoryType === 'Private' && gitHubObj.authenticationType === 'userName'){
        var cryptoConfig = appConfig.cryptoSettings;
        var cryptography = new Cryptography(cryptoConfig.algorithm, cryptoConfig.password);
        gitHubObj.repositoryPassword =  cryptography.encryptText(gitHubObj.repositoryPassword, cryptoConfig.encryptionEncoding,
            cryptoConfig.decryptionEncoding);
    }
    gitHubModel.updateGitHub(gitHubId, gitHubObj, function (err, gitHub) {
        if (err && err.name === 'ValidationError') {
            var err = new Error('Bad Request');
            err.status = 400;
            callback(err);
        } else if (err) {
            var err = new Error('Internal Server Error');
            err.status = 500;
            callback(err);
        } else {
            callback(null, gitHub);
        }
    });
};

gitGubService.deleteGitHub = function deleteGitHub(gitHubId, callback) {
    gitHubModel.deleteGitHub(gitHubId, function (err, gitHub) {
        if (err) {
            var err = new Error('Internal server error');
            err.status = 500;
            return callback(err);
        } else {
            return callback(null, gitHub);
        }
    });
};

gitGubService.getGitHubSync = function getGitHubSync(gitHubId, callback) {
    gitHubModel.getGitHubById(gitHubId, function (err, gitHub) {
        if (err) {
            var err = new Error('Internal Server Error');
            err.status = 500;
            return callback(err);
        } else if (!gitHub) {
            var err = new Error('Git-Hub not found');
            err.status = 404;
            return callback(err);
        } else{
            formatGitHubResponse(gitHub,function(formattedGitHub){
                if(formattedGitHub.repositoryType === 'Private' && formattedGitHub.authenticationType === 'userName') {
                    var cloneOpts = {
                        fetchOpts: {
                            callbacks: {
                                credentials: function () {
                                    return nodeGit.Cred.userpassPlaintextNew(formattedGitHub.repositoryUserName, formattedGitHub.repositoryPassword);
                                }
                            }
                        }
                    }
                    var path = "/tmp/"+ formattedGitHub.name;
                    fse.remove(path).then(function () {
                        nodeGit.Clone(
                            formattedGitHub.repositoryURL,
                            path,
                            cloneOpts)
                            .then(function (repo) {
                                callback(null,repo);
                            }).catch(function(err){
                            callback(err,null);
                        })
                    });
                }else if(formattedGitHub.repositoryType === 'Private' && formattedGitHub.authenticationType === 'sshKey') {
                    var cloneOpts = {
                        fetchOpts: {
                            callbacks: {
                                credentials: function () {
                                    return nodeGit.Cred.sshKeyNew(formattedGitHub.repositoryUserName, formattedGitHub.repositorySSHPublicKeyFileData,formattedGitHub.repositorySSHPrivateKeyFileData,'');
                                }
                            }
                        }
                    }
                    var path = "/tmp/"+ formattedGitHub.name;
                    fse.remove(path).then(function () {
                        nodeGit.Clone(
                            formattedGitHub.repositoryURL,
                            path,
                            cloneOpts)
                            .then(function (repo) {
                                callback(null,repo);
                            }).catch(function(err){
                            callback(err,null);
                        })
                    });
                }else{
                    var path = "/tmp/"+ formattedGitHub.name;
                    nodeGit.Clone(formattedGitHub.repositoryURL, path, {}).then(function (repo) {
                        callback(null,repo);
                    }).catch(function (err) {
                        callback(err,null);
                    });
                }
            })
        }
    });
};

gitGubService.getGitHubList = function getGitHubList(query, callback) {
    var params = {};
    logger.debug('get GitHub');
    if ('filterBy' in query) {
        params = parseFilterBy(query.filterBy);
    }
    gitHubModel.getGitHubList(params, function (err, gitHubList) {
        if (err) {
            logger.error(err);
            var err = new Error('Internal Server Error');
            err.status = 500;
            return callback(err);
        } else {
            var response = [];
            if (gitHubList.length > 0) {
                for (var i = 0; i < gitHubList.length; i++) {
                    formatGitHubResponse(gitHubList[i],function(formattedData){
                        response.push(formattedData);
                        if (response.length === gitHubList.length) {
                            return callback(null, response);
                        }else{
                            return;
                        }
                    });
                }
            } else {
                return callback(null, response);
            }
        }
    });
};

gitGubService.getGitHubById = function getGitHubById(gitHubId, callback) {
    gitHubModel.getGitHubById(gitHubId, function (err, gitHub) {
        if (err) {
            var err = new Error('Internal Server Error');
            err.status = 500;
            return callback(err);
        } else if (!gitHub) {
            var err = new Error('Git-Hub not found');
            err.status = 404;
            return callback(err);
        } else{
            formatGitHubResponse(gitHub,function(err,formattedData){
                callback(null,formattedData);
            });
        }
    });
};


function parseFilterBy(filterByString) {
    var filterQuery = {};
    var filters = filterByString.split('+');
    for (var i = 0; i < filters.length; i++) {
        var filter = filters[i].split(':');
        var filterQueryValues = filter[1].split(",");
        filterQuery[filter[0]] = {'$in': filterQueryValues};
    }
    return filterQuery;
};

function formatGitHubResponse(gitHub,callback) {
    var formatted = {
        _id:gitHub._id,
        name:gitHub.name,
        description:gitHub.description,
        repositoryURL:gitHub.repositoryURL,
        repositoryType:gitHub.repositoryType
    };
    if (gitHub.organization.length) {
        formatted.orgId = gitHub.organization[0].rowid;
        formatted.orgName=gitHub.organization[0].orgname;
    }
    if (gitHub.repositoryType === 'Private' && gitHub.authenticationType === 'userName') {
        formatted.repositoryUserName = gitHub.repositoryUserName;
        var cryptoConfig = appConfig.cryptoSettings;
        var cryptography = new Cryptography(cryptoConfig.algorithm, cryptoConfig.password);
        formatted.repositoryPassword =  cryptography.decryptText(gitHub.repositoryPassword, cryptoConfig.decryptionEncoding,
            cryptoConfig.encryptionEncoding);
        callback(formatted);
    }else if (gitHub.repositoryType === 'Private' && gitHub.authenticationType === 'sshKey') {
        fileUpload.getReadStreamFileByFileId(gitHub.repositorySSHPublicKeyFileId,function(err,publicKeyFile){
            if(err){
                var err = new Error('Internal server error');
                err.status = 500;
                logger.error(err);
            }
            formatted.repositorySSHPublicKeyFileId = gitHub.repositorySSHPublicKeyFileId;
            formatted.repositorySSHPublicKeyFileName = publicKeyFile.fileName;
            formatted.repositorySSHPublicKeyFileData = publicKeyFile.fileData;
            fileUpload.getReadStreamFileByFileId(gitHub.repositorySSHPrivateKeyFileId,function(err,privateKeyFile){
                if(err){
                    var err = new Error('Internal server error');
                    err.status = 500;
                    logger.error(err);
                }
                formatted.repositorySSHPrivateKeyFileId = gitHub.repositorySSHPrivateKeyFileId;
                formatted.repositorySSHPrivateKeyFileName = privateKeyFile.fileName;
                formatted.repositorySSHPrivateKeyFileData = privateKeyFile.fileData;
                callback(formatted);
            });
        });
    }else {
        callback(formatted);
    }
}
