window.coordinate = function (latitude, longitude, city){
	
	var markercity = new google.maps.Marker({
    position:{lat:latitude, lng:longitude},
	});

	markercity.setMap(window.map);

	var infowindowcity = new google.maps.InfoWindow({
	content:city
	});
	
	infowindowcity.open(window.map,markercity);
}