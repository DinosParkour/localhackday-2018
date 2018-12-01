var map, client, popup, searchInput, resultsPanel, searchInputLength;
var results, userLocation, lastCoords;

var datasource = new atlas.source.DataSource();

//The minimum number of characters needed in the search input before a search is performed.
var minSearchInputLength = 3;

//The number of ms between key strokes to wait before performing a search.
var keyStrokeDelay = 150;

function getMap() {
    //Add your Azure Maps subscription key to the map SDK.
    //Get an Azure Maps key at https://azure.com/maps

    var useKey = false;

    var key;
    if (useKey) {
        key = '';
    } else {
        key = prompt('Enter your key');
    }

    atlas.setSubscriptionKey(key);

    //Initialize a map instance.
    map = new atlas.Map("map", {
        center: [22.9533, 40.6312],
        zoom: 14,
        style: "grayscale_dark"
    });

    //Create an instance of the services client.
    client = new atlas.service.Client(atlas.getSubscriptionKey());

    //Store a reference to the Search Info Panel.
    resultsPanel = document.getElementById("results-panel");

    //Add key up event to the search box. 
    searchInput = document.getElementById("search-input");
    searchInput.addEventListener("keyup", searchInputKeyup);

    //Create a popup which we can reuse for each result.
    popup = new atlas.Popup();

    //Wait until the map resources have fully loaded.
    map.events.add('load', function () {
        addTools();

        //Create a data source and add it to the map.
        map.sources.add(datasource);

        //Add a layer for rendering the results.
        var searchLayer = new atlas.layer.SymbolLayer(datasource, null, {
            iconOptions: {
                image: 'pin-round-darkblue',
                anchor: 'center',
                allowOverlap: true
            }
        });
        map.layers.add(searchLayer);

        //Add a click event to the search layer and show a popup when a result is clicked.
        map.events.add("click", searchLayer, function (e) {
            //Make sure the event occured on a shape feature.
            if (e.shapes && e.shapes.length > 0) {
                var shape = e.shapes[0];
                showPopup(shape);

                var startCoords;
                var endCoords = shape.getCoordinates();
                if (lastCoords) {
                    startCoords = lastCoords;
                } else {
                    startCoords = userLocation.geometry.coordinates;
                }
                lastCoords = endCoords;

                var routeQuery = startCoords[1] + ','
                    + startCoords[0] + ':'
                    + endCoords[1] + ','
                    + endCoords[0];

                //Execute the car route query then add the route to the map once a response is received.
                client.route.getRouteDirections(routeQuery).then(function (response) {
                    // Parse the response into GeoJSON
                    var geoJsonResponse = new atlas.service.geojson.GeoJsonRouteDirectionsResponse(response);

                    //Add the route line to the data source.
                    datasource.add(geoJsonResponse.getGeoJsonRoutes().features[0]);
                    var userId = userLocation.id;
                    if (userId) {
                        datasource.remove(datasource.getShapeById(userId));
                    }
                });
            }

            // var popup = document.getElementById("poi-box");
            // popup.remove();
        });

        //Add a layer for rendering the route lines and have it render under the map labels.
        map.layers.add(new atlas.layer.LineLayer(datasource, null, {
            strokeColor: '#2272B9',
            strokeWidth: 5,
            lineJoin: 'round',
            lineCap: 'round',
            filter: ['==', '$type', 'LineString']
        }), 'labels');

        //Add a layer for rendering point data.
        map.layers.add(new atlas.layer.SymbolLayer(datasource, null, {
            iconOptions: {
                image: ['get', 'icon'],
                allowOverlap: true
            },
            textOptions: {
                textField: ['get', 'title'],
                offset: [0, 1.2]
            },
            filter: ['==', '$type', 'Point']
        }));
    });
}

function searchInputKeyup(e) {
    if (searchInput.value.length >= minSearchInputLength) {
        if (e.keyCode === 13) {

            //Wait 100ms and see if the input length is unchanged before performing a search. 
            //This will reduce the number of queries being made on each character typed.
            setTimeout(function () {
                if (searchInputLength == searchInput.value.length) {
                    search();
                }
            }, keyStrokeDelay);
            return;
        }
    }

    searchInputLength = searchInput.value.length;
}

function search() {
    popup.close();
    resultsPanel.innerHTML = '';

    var query = document.getElementById("search-input").value;

    client.search.getSearchFuzzy(query, {
        lon: map.getCamera().center[0],
        lat: map.getCamera().center[1],
        maxFuzzyLevel: 4
    }).then(response => {
        if (response && response.results != null && response.results.length > 0) {
            //Parse the response into GeoJSON so that the map can understand.
            var geojsonResponse = new atlas.service.geojson.GeoJsonSearchResponse(response);
            results = geojsonResponse.getGeoJsonResults();

            userLocation = results.features[0];
            datasource.add(userLocation);
            itemHovered(userLocation.id);
            itemClicked(userLocation.id);
        }
    });
}

function addHistoricPlace(name) {
    client.search.getSearchFuzzy(name, {
        lon: map.getCamera().center[0],
        lat: map.getCamera().center[1],
        maxFuzzyLevel: 4
    }).then(response => {
        if (response && response.results != null && response.results.length > 0) {
            //Parse the response into GeoJSON so that the map can understand.
            var geojsonResponse = new atlas.service.geojson.GeoJsonSearchResponse(response);
            results = geojsonResponse.getGeoJsonResults();

            userLocation = results.features[0];
            datasource.add(userLocation);
        }
    });
}

function addTools() {
    //Construct a pitch control with light style
    var pitchControl = new atlas.control.PitchControl({
        style: "dark"
    });

    //Add the pitch control to the map
    map.controls.add(pitchControl, {
        position: "bottom-right"
    });

    //Construct a style control
    var styleControl = new atlas.control.StyleControl();

    //Add the Style Control to the map
    map.controls.add(styleControl, {
        position: "bottom-right"
    })

    //Construct a zoom control
    var zoomControl = new atlas.control.ZoomControl();

    //Add the zoom control to the map.
    map.controls.add(zoomControl, {
        position: 'bottom-right'
    });
}

function itemHovered(id) {
    //Show a popup when hovering an item in the result list.
    var shape = datasource.getShapeById(id);

    showPopup(shape);
}

function itemClicked(id) {
    //Center the map over the clicked item from the result list.
    var shape = datasource.getShapeById(id);

    map.setCamera({
        center: shape.getCoordinates(),
        zoom: 15
    });
}

function showPopup(shape) {
    var properties = shape.getProperties();

    //Create the HTML content of the POI to show in the popup.
    var html = ['<div id="poi-box">'];

    //Add a title section for the popup.
    html.push('<div class="poi-title-box"><b>');

    if (properties.poi && properties.poi.name) {
        html.push(properties.poi.name);
    } else {
        html.push(properties.address.freeformAddress);
    }

    html.push('</b></div>');

    //Create a container for the body of the content of the popup.
    html.push('<div class="poi-content-box">');

    html.push('<div class="info location">', properties.address.freeformAddress, '</div>');

    if (properties.poi) {
        if (properties.poi.phone) {
            html.push('<div class="info phone">', properties.phone, '</div>');
        }

        if (properties.poi.url) {
            html.push('<div><a class="info website" href="http://', properties.poi.url, '">http://', properties.poi.url, '</a></div>');
        }
    }

    html.push('</div></div>');

    popup.setPopupOptions({
        position: shape.getCoordinates(),
        content: html.join('')
    });

    popup.open(map);
}
