import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Animated,
  Image,
  Dimensions,
} from 'react-native';
import { MapView } from 'expo';
import YelpAPI from 'v3-yelp-api';
import config from './yelpAPIKeys';

const { width, height } = Dimensions.get("window");

const CARD_HEIGHT = height / 3;
const CARD_WIDTH =  width / 3 + 75;

export default class App extends React.Component {
  constructor() {
    super();
    this.state = {
      dataSource: [],
      searchText: '',
      position: {
        coords: {
          latitude: 42.3601,
          longitude: 71.0589
        }
      },
    };
  }

  componentWillMount() {
    this.index = 0;
    this.animation = new Animated.Value(0);
    navigator.geolocation.getCurrentPosition(
      (position) => { this.setState({ position }, () => this.getData())},
      (error) => alert(error),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
    );
  }
  componentDidMount() {
    // We should detect when scrolling has stopped then animate
    // We should just debounce the event listener here
    this.animation.addListener(({ value }) => {
      let index = Math.floor(value / CARD_WIDTH + 0.3); // animate 30% away from landing on the next item
      if (index >= this.state.dataSource.length) {
        index = this.state.dataSource.length - 1;
      }
      if (index <= 0) {
        index = 0;
      }

      clearTimeout(this.regionTimeout);
      this.regionTimeout = setTimeout(() => {
        if (this.index !== index) {
          this.index = index;
          const { coordinates } = this.state.dataSource[index];
          this.map.animateToRegion(
            {
              ...coordinates,
              latitudeDelta: 0.003,
              longitudeDelta: 0.003,
            },
            350
          );
        }
      }, 10);
    });
  }

  getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
    // console.log(lat1,lon1,lat2,lon2)
    var R = 6371; // Radius of the earth in km
    var dLat = this.deg2rad(lat2-lat1);  // deg2rad below
    var dLon = this.deg2rad(lon2-lon1);
    var a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon/2) * Math.sin(dLon/2)
      ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c; // Distance in km
    return Math.round(d*1000); //Distance in meters
  }
  deg2rad(deg) {
    return deg * (Math.PI/180)
  }
  
  onRegionChange(region) {
    this.setState({ region });
  }

  async getData() {
    const credentials = {
      appId: config.CLIENT_ID,
      appSecret: config.CLIENT_SECRET
    };

    const yelp = new YelpAPI(credentials);

    const lat = this.state.position.coords.latitude;
    const lng = this.state.position.coords.longitude;

    const latlng = String(lat) + "," + String(lng)
    const params = {
      term: 'fitness',
      location: latlng,
      limit: '40',
      sort_by: 'distance',
    };

    return yelp.search(params)
    .then(searchResults => this.setState({ dataSource: searchResults.businesses }));
  }

  render() {
    const interpolations = this.state.dataSource.map((studio, index) => {
      const inputRange = [
        (index - 1) * CARD_WIDTH,
        index * CARD_WIDTH,
        ((index + 1) * CARD_WIDTH),
      ];
      const scale = this.animation.interpolate({
        inputRange,
        outputRange: [1, 2.5, 1],
        extrapolate: "clamp",
      });
      const opacity = this.animation.interpolate({
        inputRange,
        outputRange: [0.35, 1, 0.35],
        extrapolate: "clamp",
      });
      return { scale, opacity };
    });
    return (
      <View style={styles.container}>
        <MapView
        ref={map => this.map = map}
         style={styles.container}
         region={{
          latitude: this.state.position.coords.latitude,
          latitudeDelta: 0.003,
          longitude: this.state.position.coords.longitude,
          longitudeDelta: 0.003
        }}
        >
        <MapView.Marker
          coordinate={this.state.position.coords}
          pinColor={'#FF8383'}
          title={"You are here"}
        /> 
        {this.state.dataSource.map((studio, index) => {
          const scaleStyle = {
            transform: [
              {
                scale: interpolations[index].scale,
              },
            ],
          };
          const opacityStyle = {
            opacity: interpolations[index].opacity,
          };
          return (
            <MapView.Marker key={index} coordinate={studio.coordinates} title={studio.title}>
              <Animated.View style={[styles.markerWrap, opacityStyle]}>
                <Animated.View style={[styles.ring, scaleStyle]} />
                <Image
                  source={{uri: 'https://d30y9cdsu7xlg0.cloudfront.net/png/466088-200.png' }}
                  style={styles.pin}
                />
              </Animated.View>
            </MapView.Marker>
          );
        })}
        </MapView>
        <Animated.ScrollView
          horizontal
          scrollEventThrottle={1}
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH}
          onScroll={Animated.event(
            [
              {
                nativeEvent: {
                  contentOffset: {
                    x: this.animation,
                  },
                },
              },
            ],
            { useNativeDriver: true }
          )}
          style={styles.scrollView}
          contentContainerStyle={styles.endPadding}
        >
        {this.state.dataSource.map((studio, index) => (
          <View style={styles.card} key={index}>
            <Image
              source={{uri: studio.image_url || 'https://d30y9cdsu7xlg0.cloudfront.net/png/466088-200.png' }}
              style={styles.cardImage}
              resizeMode="cover"
            />
            <View style={styles.textContent}>
              <Text numberOfLines={1} style={styles.cardtitle}>{studio.name}</Text>
              <Text numberOfLines={1} style={styles.cardCategory}>{studio.categories[0].title}</Text>
              <Text numberOfLines={1} style={styles.cardDescription}>{studio.location.address1}</Text>
              <Text numberOfLines={1} style={styles.cardDescription}>{studio.location.city}, {studio.location.state}</Text>
              <Text numberOfLines={1} style={styles.cardDistance}>{this.getDistanceFromLatLonInKm(studio.coordinates.latitude, studio.coordinates.longitude, this.state.position.coords.latitude, this.state.position.coords.longitude)} meters away</Text>
            </View>
          </View>
        ))}
      </Animated.ScrollView>
      <View style={styles.footer}>
        <Image
          source={require('./assets/Yelp_trademark_RGB_outline.png')}
          style={styles.yelp}
        />
      </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    paddingVertical: 10,
  },
  endPadding: {
    paddingRight: width - CARD_WIDTH,
  },
  card: {
    padding: 10,
    elevation: 2,
    backgroundColor: "rgba(2555,2555,2555,0.8)",
    marginHorizontal: 10,
    borderRadius: 10,
    shadowColor: "#000",
    shadowRadius: 5,
    shadowOpacity: 0.3,
    shadowOffset: { x: 4, y: -4 },
    height: CARD_HEIGHT,
    width: CARD_WIDTH,
    overflow: "hidden",
  },
  cardImage: {
    flex: 2,
    width: "100%",
    height: "75%",
    borderRadius: 10,
    alignSelf: "center",
  },
  textContent: {
    flex: 1,
  },
  cardtitle: {
    fontSize: 12,
    marginTop: 5,
    fontWeight: "bold",
    color: 'rgba(243,107,117, 0.9)'
  },
  cardDescription: {
    fontSize: 12,
    color: "#444",
  },
  cardDistance: {
    fontStyle: 'italic',
    fontSize: 12,
    color: "#444",
    fontWeight: '300'
  },
  cardCategory: {
    fontSize: 12,
    fontWeight: "bold",
    color: "rgba(243,107,117, 0.5)"
  },
  markerWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  pin: {
    width: 25,
    height: 25,
  },
  ring: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(243,107,117, 0.3)",
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(243,107,117, 0.5)",
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center'
  },
  yelp: {
    width: 50,
    height: 20
  },
});