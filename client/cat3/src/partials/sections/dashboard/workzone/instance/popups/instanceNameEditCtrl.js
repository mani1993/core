(function(){
	"use strict";
	angular.module('workzone.instance')
	.controller('editNameCtrl', ['$scope', '$modalInstance', 'items', 'workzoneServices', function($scope, $modalInstance, items, workzoneServices) {
		$scope.instanceName = items.name;
		$scope.ok = function() {
			var formdata = {
				'name': $scope.instanceName
			};
			//alert added when there is no instance name added at the time of edit.
			if(!$scope.instanceName){
				alert('Please enter the Instance Name');
				return false;
			}
			workzoneServices.postInstanceNameUpdate(items._id, formdata).then(function() {
				items.name = $scope.instanceName;
				$scope.cancel();
			});
		};

		$scope.cancel = function() {
			$modalInstance.dismiss('cancel');
		};
	}]);
 })();