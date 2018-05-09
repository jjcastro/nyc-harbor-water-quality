var map, heatmap;

var metrics = [
  "Top Salinity  (psu)",
  "Top Active Chlorophyll 'A' (µg/L)",
  "Top Dissolved Organic Carbon (mg/L)",
  "Top Turbidity( Nephelometric Turbidity Units)",
  "Top Fluorometer (mg/m3)",
  "Percentage O2 Saturation Top Sample"
];

var metric = "Top Salinity  (psu)";

var minLong = -74.3;
var maxLong = -73.6;

var maxLat = 41.045833;
var minLat = 40.4;

var width = 0.01;

var decimalsWidth = Math.abs(Math.log10(width)); 

var pools;
var poolsArrays;
var poolsYearlyMax;

var overlayVisible = true;
var blueGradient = false;

var loading = true;


function getFloor(val) {
  return parseFloat(
    (Math.floor(val / width) * width).toFixed(decimalsWidth)
  );
}

function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

function doneLoading() {
  send();
  $('#loader').css('display', 'none');
  $('#info-message').html("Move the slider to travel in time!");
  loading = false;
}

function changeMetric(newMetric) {
  $('#loader').css('display', 'block');
  $('#info-message').html("Loading...");
  loading = true;

  metric = newMetric;
  initPools();
  dataPoints();
}

function initPools() {

  pools = {};
  poolsArrays = {};
  poolsYearlyMax = {};

  for (var yr = 1910; yr <= 2017; yr++) {
    pools[yr] = {};
    poolsArrays[yr] = [];
    for (var i = getFloor(minLat, width); i <= maxLat; i += width) {
      var latPool = parseFloat(i.toFixed(decimalsWidth));
      pools[yr][latPool] = {};
      for (var j = getFloor(minLong, width); j <= maxLong; j += width) {
        var longPool = parseFloat(j.toFixed(decimalsWidth));
        pools[yr][latPool][longPool] = {
          sum: 0,
          total: 0
        };
      }
    }
  }

}

function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 11,
    zoomControl: false,
    minZoom: 11,
    maxZoom: 11,
    center: {lat: 40.7, lng: -73.95},
    mapTypeId: 'satellite'
  });

  map.data.loadGeoJson(
      'https://raw.githubusercontent.com/dwillis/nyc-maps/master/boroughs.geojson');
  map.data.setStyle({
    strokeColor: 'white',
    fillColor: 'black',
    fillOpacity: 0.5
  });

  initPools();

  heatmap = new google.maps.visualization.HeatmapLayer({
    data: [],
    map: map,
    radius: 50
    // dissipating: false,
  });

  dataPoints();

  
}

function toggleHeatmap() {
  heatmap.setMap(heatmap.getMap() ? null : map);
}

function dataPoints() {
  Papa.parse("./water-nyc.csv", {
    download: true,
    header: true,
    worker: true,
    complete: function(results) {
      var checkMap = {};
      var list = [];

      var checkValue = function(val) {
        return val != null && val != "" && !isNaN(parseFloat(val));
      };

      results.data.forEach((elem) => {

        if (checkValue(elem["Lat"]) && checkValue(elem["Long"])) {

          var latV = getFloor(elem["Lat"]);
          var lonV = getFloor(elem["Long"]);

          var yr = new Date(elem["Sample Date"]).getYear() + 1900;

          if (pools[yr] != null && pools[yr][latV] != null &&
              pools[yr][latV][lonV] != null &&
              !isNaN(parseFloat(elem[metric]))) {
            var distance = getDistanceFromLatLonInKm(
              latV + (width/2),
              lonV + (width/2),
              parseFloat(elem["Lat"]),
              parseFloat(elem["Long"])
            );

            pools[yr][latV][lonV].sum += parseFloat(elem[metric]);;
            pools[yr][latV][lonV].total += 1;;

            // var avg = pools[yr][latV][lonV].sum / pools[yr][latV][lonV].total;
          }

          checkMap[elem["Lat"]+elem["Long"]] = "yes";
        }
      });


      // Object.keys({1943:{}}).forEach(function(year) {
      Object.keys(poolsArrays).forEach(function(year) {

        var isAllNaN = true;
        var yearlyMax = 0;

        Object.keys(pools[year]).forEach(function(lat) {

          var longPool = pools[year][lat];
          Object.keys(longPool).forEach(function(long) {
          
            var value = longPool[long];
            var avg = value.sum / value.total;

            poolsArrays[year].push({location: 
              new google.maps.LatLng(parseFloat(lat) + (width/2),
                                     parseFloat(long) + (width/2)),
              weight: isNaN(avg) ? 0.5 : avg
            });

            if (!isNaN(avg) && avg > yearlyMax) {
              yearlyMax = avg;
            }

            isAllNaN = isAllNaN && isNaN(avg);
          });
        });

        poolsYearlyMax[year] = yearlyMax;
        if (isAllNaN) {poolsArrays[year] = [];}
      });

      console.log(poolsYearlyMax);

      doneLoading();
    }
  });
}

function showMax(year) {
  $('#max-val').html((poolsYearlyMax[year]).toFixed(2));
}

function send() {
  heatmap.setData(poolsArrays[$('#year').val()]);
  showMax($('#year').val());
}

$('input#year').on("change mousemove", function() {
  if (!loading) {
    $('#year-name').html($(this).val());
    var yearData = poolsArrays[$(this).val()];

    if (yearData.length != 0) {
      showMax($('#year').val());
      heatmap.setData(yearData);
      $('#info-message').html("Move the slider to travel in time!");
    } else {
      $('#info-message').html("No data for year: " + $(this).val());
    }
  }
});

$('select[name="metric"]').on("change", function() {
  var val = $(this).val();
  changeMetric(val);

});

function changeGradient() {
  var gradient = [
    'rgba(0, 255, 255, 0)',
    'rgba(0, 255, 255, 1)',
    'rgba(0, 191, 255, 1)',
    'rgba(0, 127, 255, 1)',
    'rgba(0, 63, 255, 1)',
    'rgba(0, 0, 255, 1)',
    'rgba(0, 0, 223, 1)',
    'rgba(0, 0, 191, 1)',
    'rgba(0, 0, 159, 1)',
    'rgba(0, 0, 127, 1)',
    'rgba(63, 0, 91, 1)',
    'rgba(127, 0, 63, 1)',
    'rgba(191, 0, 31, 1)',
    'rgba(255, 0, 0, 1)'
  ]
  heatmap.set('gradient', heatmap.get('gradient') ? null : gradient);
  blueGradient = !blueGradient;
  if (blueGradient) {
    $('.legend').addClass('blue-gradient');
  } else {
    $('.legend').removeClass('blue-gradient');
  }
}

function changeRadius() {
  overlayVisible = !overlayVisible;
  map.data.setStyle({visible: overlayVisible});
}

function changeOpacity() {
  heatmap.set('opacity', heatmap.get('opacity') ? null : 0.2);
}
