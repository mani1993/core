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
var mongoose = require('mongoose');
var BaseAuditTrail = require('./base-audit-trail');
var ObjectId = require('mongoose').Types.ObjectId;
var mongoosePaginate = require('mongoose-paginate');

var AuditTrailSchema = new BaseAuditTrail();
AuditTrailSchema.plugin(mongoosePaginate);

AuditTrailSchema.statics.getAuditTrailList = function(auditTrailQuery,callback){
    AuditTrail.paginate(auditTrailQuery.queryObj, auditTrailQuery.options, function(err, auditTrailList) {
        if (err) {
            logger.error(err);
            var error = new Error('Internal server error');
            error.status = 500;
            return callback(error);
        }
        return callback(null, auditTrailList);
    });
};

AuditTrailSchema.statics.updateAuditTrail = function(auditId,auditObj,callback){
    AuditTrail.update({_id:new ObjectId(auditId)},{$set:auditObj},{upsert:false}, function(err, updateAuditTrail) {
        if (err) {
            logger.error(err);
            var error = new Error('Internal server error');
            error.status = 500;
            return callback(error);
        }
        return callback(null, updateAuditTrail);
    });
};


var AuditTrail = mongoose.model('auditTrails', AuditTrailSchema);
module.exports = AuditTrail;

