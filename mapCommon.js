//map-common.js
import { MarkerClusterer } from "@googlemaps/markerclusterer";
let gMap; //맵
let gClusterer; //클러스터
let gInfoWindow; //정보창
let gPolylines = []; //선
let gArrowMarkers = []; // 화살표
let gZoomChangedListener; // 줌 변경 이벤트 리스너
let gMarkers; //마커정보

//거리계산
let gRouteMarkers = []; // 경로 마커 배열
let gDirectionsRenderer = null; // 경로 렌더러

export default {
    name: "gMap",
    inject: ["fn_showAlert", "fn_showConfirm"],
    methods: {
        /**
         * 구글맵 라이브러리 로드
         */
        async loadGoogleLibraries() {
            try {
                await this.$google.load();
                const { Map, InfoWindow } = await google.maps.importLibrary(
                    "maps"
                );
                const { AdvancedMarkerElement, PinElement } =
                    await google.maps.importLibrary("marker");
                await google.maps.importLibrary("geometry");
                await google.maps.importLibrary("places"); //길찾기 자동완성
                return { Map, InfoWindow, AdvancedMarkerElement, PinElement };
            } catch (error) {
                console.error("Google Maps Libraries 로드 실패", error);
                throw error;
            }
        },
        /**
         * 맵 생성
         */
        gfn_gMapCreate(str, options = {}) {
            // 기본 옵션
            const defaultOptions = {
                zoom: 10,
                center: { lat: 53.543764, lng: 9.966759 },
                mapId: str,
                minZoom: 3, // 지도의 최소 줌 레벨
                disableDefaultUI: false,
                streetViewControl: false,
                mapTypeId: google.maps.MapTypeId.ROADMAP,
            };

            const mapOptions = { ...defaultOptions, ...options };
            gMap = new google.maps.Map(
                document.getElementById(str),
                mapOptions
            );
            return gMap;
        },

        /**
         * 마커 추가 및 클러스터링, 정보창
         * @param {Object} markerData - 마커와 클러스터링에 대한 설정 및 데이터
         * @param {boolean} [markerData.cluster=true] - 기본 클러스터링 사용 여부
         * @param {Array<Object>} markerData.data - 마커 생성에 필요한 데이터 배열
         * @param {Object} markerData.data[].position - 마커의 위치 (위도, 경도)
         * @param {number} markerData.data[].position.lat - 위도 (Latitude)
         * @param {number} markerData.data[].position.lng - 경도 (Longitude)
         * @param {string} markerData.data[].title - 마커 타이틀
         */
        gfn_gMapCreateMarkers(markerData) {
            // 마커 생성
            gMarkers = markerData.data.map((data) => {
                let content = null;
                if (data.type.length > 0) {
                    content = this.createIcon(data.type);
                }

                const marker = new google.maps.marker.AdvancedMarkerElement({
                    position: data.position,
                    title: data.title,
                    zIndex: 10,
                    content: content,
                });

                if (!markerData.cluster) {
                    marker.map = gMap;
                }

                //추가마커 데이터 설정
                Object.keys(data).forEach((val) => {
                    if (val !== "position" && val !== "title") {
                        marker[val] = data[val];
                    }
                });
                return marker;
            });

            // 마커 생성 후 클러스터 자동 실행
            const customCluster = markerData.customCluster;
            const cluster =
                markerData.cluster !== undefined ? markerData.cluster : true;
            if (customCluster) {
                this.gfn_gMapCustomClusterer(gMarkers);
            } else if (cluster) {
                this.gfn_gMapClusterer(gMarkers);
            }
            this.gfn_gMapSetClusterInfoWindowNoPan(); // 인포윈도우 자동이동 버그 방지

            this.gfn_gMapCreateInfoWindows(gMarkers); // 정보창 생성
            this.gfn_gMapSetZIndexOnClick(gMarkers); //zIndex설정
            return gMarkers;
        },

        /**
         * 커스텀 아이콘 생성 함수
         * @param {string} type - 아이콘 타입 (start, end, delivery 등)
         * @returns {HTMLElement} - 생성된 커스텀 아이콘
         */
        createIcon(type) {
            const customIcon = document.createElement("div");
            customIcon.style.width = "40px";
            customIcon.style.height = "40px";
            customIcon.style.backgroundSize = "cover";
            customIcon.style.position = "absolute";

            switch (type) {
                case "start":
                    customIcon.style.backgroundImage =
                        "url('/images/map/icon07.png')";
                    customIcon.style.transform = "translate(-35%, -100%)";
                    break;
                case "end":
                    customIcon.style.backgroundImage =
                        "url('/images/map/icon08.png')";
                    customIcon.style.transform = "translate(-35%, -100%)";
                    break;
                case "delivery":
                    customIcon.style.width = "35px";
                    customIcon.style.height = "40px";
                    customIcon.style.backgroundImage =
                        "url('/images/map/icon01.png')";
                    customIcon.style.transform = "translate(-35%, -100%)";
                    break;
                default:
                    customIcon.style.width = "25px";
                    customIcon.style.height = "40px";
                    customIcon.style.backgroundImage =
                        "url('https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi2.png')";
                    break;
            }

            return customIcon;
        },

        /**
         * 클러스터
         * @param object markerData
         */
        gfn_gMapClusterer(markers) {
            gClusterer = new MarkerClusterer({ markers: markers, map: gMap });
        },

        /**
         * 커스텀 클러스터
         */
        gfn_gMapCustomClusterer(markers) {
            const clusterOptions = {
                colorThreshold: 5, // 5개 이상일 때 색상 변경
                thresholds: [
                    { count: 1, color: "blue" },
                    { count: 5, color: "darkblue" },
                    { count: 50, color: "gray" },
                    { count: 100, color: "green" },
                    { count: 200, color: "orange" },
                    { count: 500, color: "red" },
                ],
                clusterSize: { width: "50px", height: "50px" }, // 클러스터 크기
                fontSize: "14px", // 글꼴 크기
            };

            const customRenderer = {
                render({ count, position }) {
                    let color = clusterOptions.defaultColor; // 기본 색상

                    for (const threshold of clusterOptions.thresholds) {
                        if (count > threshold.count) {
                            color = threshold.color;
                        }
                    }

                    const div = document.createElement("div");
                    div.style.backgroundColor = color;
                    div.style.borderRadius = "50%";
                    div.style.width = clusterOptions.clusterSize.width;
                    div.style.height = clusterOptions.clusterSize.height;
                    div.style.display = "flex";
                    div.style.alignItems = "center";
                    div.style.justifyContent = "center";
                    div.style.color = "white";
                    div.style.fontSize = clusterOptions.fontSize;
                    div.innerText = count;

                    return new google.maps.marker.AdvancedMarkerElement({
                        position,
                        content: div,
                    });
                },
            };

            gClusterer = new MarkerClusterer({
                markers: markers,
                map: gMap,
                renderer: customRenderer,
            });
        },

        /**
         * 클러스터 클릭시 인포윈도우화면 자동이동 비활성화
         */
        gfn_gMapSetClusterInfoWindowNoPan() {
            this.gfn_gMapOnClusterClick(gClusterer, () => {
                gInfoWindow.setOptions({ disableAutoPan: true }); // 지도 이동 방지
                setTimeout(() => {
                    gInfoWindow.setOptions({ disableAutoPan: false });
                }, 100);
            });
        },

        /**
         * 선으로 경로 표시
         * @param {Array<Object>} path - 경로를 구성하는 좌표 배열
         * @param {number} path[].lat - 위도
         * @param {number} path[].lng - 경도
         * @returns {void}
         */
        gfn_gMapPolyline(path) {
            const flightPath = new google.maps.Polyline({
                path: path,
                geodesic: true,
                strokeColor: "#FF0000",
                strokeOpacity: 1.0,
                strokeWeight: 2,
            });

            gPolylines.push(flightPath); // 선
            flightPath.setMap(gMap);
        },

        /**
         * 선과 화살표로 경로 표시
         * @param {Array<Object>} path - 경로를 구성하는 좌표 배열
         * @param {number} path[].lat - 위도
         * @param {number} path[].lng - 경도
         * @returns {void}
         */
        gfn_gMapPolylineWithDynamicArrow(path) {
            const flightPath = new google.maps.Polyline({
                path: path,
                geodesic: true,
                strokeColor: "#FF0000",
                strokeOpacity: 1.0,
                strokeWeight: 2,
            });

            gPolylines.push(flightPath); // 선
            flightPath.setMap(gMap);

            // 경로에 클릭 이벤트 추가하여 줌 맞춤
            this.gfn_gMapOnClick(flightPath, () => {
                const bounds = new google.maps.LatLngBounds();
                path.forEach((point) => {
                    bounds.extend(new google.maps.LatLng(point.lat, point.lng));
                });
                gMap.fitBounds(bounds); // 경로에 맞춰 지도 줌 조정
            });

            const createArrowMarkers = (zoomLevel) => {
                // 기존 화살표 제거
                gArrowMarkers.forEach((marker) => marker.setMap(null));
                gArrowMarkers.length = 0;

                // 줌에 따라 화살표크기 조정
                let scale;
                if (zoomLevel >= 1 && zoomLevel < 7) {
                    scale = 0.6;
                } else if (zoomLevel >= 7 && zoomLevel < 10) {
                    scale = 1.0;
                } else if (zoomLevel > 10 && zoomLevel < 14) {
                    scale = 0.9;
                } else if (zoomLevel >= 15) {
                    scale = 0.8;
                }

                for (let i = 0; i < path.length - 1; i++) {
                    const start = path[i];
                    const end = path[i + 1];
                    //const midpoint = this.calculateMidpoint(start, end); // 중간 지점 계산
                    const angle = this.calculateBearing(start, end) - 90;

                    // 두 지점 간의 거리 계산
                    const distance =
                        google.maps.geometry.spherical.computeDistanceBetween(
                            new google.maps.LatLng(start.lat, start.lng),
                            new google.maps.LatLng(end.lat, end.lng)
                        );

                    // 줌 레벨이 낮거나 두 지점 간의 거리가 너무 짧으면 화살표를 건너뛴다.
                    if (zoomLevel > 1 && zoomLevel < 7 && distance < 20000) {
                        continue;
                    } else if (
                        zoomLevel > 7 &&
                        zoomLevel < 12 &&
                        distance < 10000
                    ) {
                        continue;
                    } else if (distance < 1000) {
                        continue;
                    }

                    const arrowIcon = {
                        path: "M 0,0 L 10,5 L 0,10 L 3,5 Z", // 삼각형 화살표 SVG
                        fillColor: "#000000",
                        fillOpacity: 1,
                        scale: scale,
                        strokeWeight: 1,
                        rotation: angle,
                        anchor: new google.maps.Point(0, 5),
                    };

                    const marker = new google.maps.Marker({
                        position: start, // 중간 지점에 화살표 배치
                        icon: arrowIcon,
                        map: gMap,
                    });

                    // 화살표 마커 클릭 시 줌 맞춤
                    this.gfn_gMapOnClick(marker, () => {
                        this.fitPathToBounds(path);
                    });

                    gArrowMarkers.push(marker); // 화살표 저장
                }
            };

            // 초기 화살표 생성
            createArrowMarkers(gMap.getZoom());

            // 줌 변경 이벤트 등록
            gZoomChangedListener = this.gfn_gMapZoomChanged(gMap, () => {
                const currentZoom = gMap.getZoom();
                createArrowMarkers(currentZoom);
            });
        },

        /**
         * 두 지점의 중간 지점을 계산
         * @param {Object} start - 시작 지점 좌표
         * @param {number} start.lat - 위도
         * @param {number} start.lng - 경도
         * @param {Object} end - 끝 지점 좌표
         * @param {number} end.lat - 위도
         * @param {number} end.lng - 경도
         * @returns {Object} - 중간 지점 좌표
         */
        calculateMidpoint(start, end) {
            return {
                lat: (start.lat + end.lat) / 2,
                lng: (start.lng + end.lng) / 2,
            };
        },

        /**
         * 두 지점 간 방위각 계산
         * @param {Object} start - 시작 지점 좌표
         * @param {number} start.lat - 위도
         * @param {number} start.lng - 경도
         * @param {Object} end - 끝 지점 좌표
         * @param {number} end.lat - 위도
         * @param {number} end.lng - 경도
         * @returns {number} - 방위각 (degree)
         */
        calculateBearing(start, end) {
            const lat1 = this.degToRad(start.lat);
            const lng1 = this.degToRad(start.lng);
            const lat2 = this.degToRad(end.lat);
            const lng2 = this.degToRad(end.lng);

            const dLng = lng2 - lng1;
            const y = Math.sin(dLng) * Math.cos(lat2);
            const x =
                Math.cos(lat1) * Math.sin(lat2) -
                Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

            let bearing = (Math.atan2(y, x) * 180) / Math.PI;
            return (bearing + 360) % 360;
        },

        /**
         * 도(degree)를 라디안(radian)으로 변환
         * @param {number} deg - 도
         * @returns {number} - 라디안
         */
        degToRad(deg) {
            return (deg * Math.PI) / 180;
        },

        /**
         * 경로에 맞게 지도 줌과 중심 조정
         * @param {Array<Object>} path - 경로를 구성하는 좌표 배열
         * @returns {void}
         */
        fitPathToBounds(path) {
            const bounds = new google.maps.LatLngBounds();
            path.forEach((point) => {
                bounds.extend(new google.maps.LatLng(point.lat, point.lng));
            });
            gMap.fitBounds(bounds);
        },

        /**
         * 마커 클릭 이벤트를 onMapClick으로 래핑
         * @param {google.maps.Marker} marker - Google Maps Marker 객체
         * @param {Function} callback - 클릭 이벤트 발생 시 실행할 함수
         */
        gfn_gMapOnClick(marker, callback) {
            marker.addListener("click", (event) => {
                if (typeof callback === "function") {
                    callback(event, marker); // 클릭된 마커와 이벤트를 콜백에 전달
                }
            });
        },
        /**
         * 줌변경이벤트
         * @param {map} gMap - Google Maps 객체
         * @param {Function} callback - 클릭 이벤트 발생 시 실행할 함수
         */
        gfn_gMapZoomChanged(gMap, callback) {
            const listener = gMap.addListener("zoom_changed", (event) => {
                if (typeof callback === "function") {
                    callback(event, gMap); // 클릭된 마커와 이벤트를 콜백에 전달
                }
            });
            return listener; // 리스너 핸들러 반환
        },

        /**
         * 지도 드래그 종료 이벤트
         * @param {google.maps.Map} gMap - Google Maps 객체
         * @param {Function} callback - 드래그 종료 이벤트 발생 시 실행할 함수
         */
        gfn_gMapOnDragEnd(gMap, callback) {
            gMap.addListener("dragend", (event) => {
                if (typeof callback === "function") {
                    callback(event, gMap); // 드래그 종료 이벤트와 맵 객체를 콜백에 전달
                }
            });
        },

        /**
         * 지도 클릭 이벤트
         * @param {google.maps.Map} gMap - Google Maps 객체
         * @param {Function} callback - 지도 클릭 이벤트 발생 시 실행할 함수
         */
        gfn_gMapOnMapClick(gMap, callback) {
            gMap.addListener("click", (event) => {
                if (typeof callback === "function") {
                    callback(event, gMap); // 클릭된 위치와 맵 객체를 콜백에 전달
                }
            });
        },

        /**
         * 지도 이동 종료 이벤트
         * @param {google.maps.Map} map - Google Maps 객체
         * @param {Function} callback - 지도 이동 종료 이벤트 발생 시 실행할 함수
         */
        gfn_gMapOnIdle(gMap, callback) {
            gMap.addListener("idle", (event) => {
                if (typeof callback === "function") {
                    callback(event, this.gfn_gMapCustomClusterermap); // 이벤트와 맵 객체를 콜백에 전달
                }
            });
        },

        /**
         * 클러스터 클릭 이벤트
         * @param {MarkerClusterer} clusterer - MarkerClusterer 객체
         * @param {Function} callback - 클러스터 클릭 시 실행할 함수
         */
        gfn_gMapOnClusterClick(clusterer, callback) {
            clusterer.addListener("click", (cluster) => {
                if (typeof callback === "function") {
                    callback(cluster, clusterer); // 클릭된 클러스터와 클러스터러 객체를 콜백에 전달
                }
            });
        },

        /**
         * 인포윈도우 생성 함수
         * @param {Array} markers - 기존에 생성된 마커 배열
         */
        gfn_gMapCreateInfoWindows(markers) {
            if (!gInfoWindow) {
                gInfoWindow = new google.maps.InfoWindow({
                    disableAutoPan: false,
                });
            }
            markers.forEach((marker) => {
                this.gfn_gMapOnClick(marker, () => {
                    const title = marker.title; // 제목
                    const position = marker.position; // 위경도
                    const type = marker.type;
                    const key = marker.key;
                    let infoContent;
                    //인포윈도우  html 설정
                    switch (type) {
                        case "start":
                            infoContent = `
                                <div style="font-family: Arial, sans-serif; width: 300px; border: 1px solid #ddd;">
                                    <div style="background-color:rgb(247, 217, 217); padding: 10px; font-weight: bold; color:rgb(143, 49, 49);">
                                        위치 정보
                                    </div>
                                    <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 10px; font-size: 14px;">
                                        <tr>
                                            <td style="padding: 5px; border-bottom: 1px solid #ddd; width: 30%; font-weight: bold;">위치명</td>
                                            <td style="padding: 5px; border-bottom: 1px solid #ddd;">${title}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 5px; border-bottom: 1px solid #ddd; width: 30%; font-weight: bold;">아이디</td>
                                            <td style="padding: 5px; border-bottom: 1px solid #ddd;">${key}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 5px; border-bottom: 1px solid #ddd; font-weight: bold;">위도</td>
                                            <td style="padding: 5px; border-bottom: 1px solid #ddd;">${position.lat}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 5px; font-weight: bold;">경도</td>
                                            <td style="padding: 5px;">${position.lng}</td>
                                        </tr>
                                    </table>
                                </div>
                            `;
                            break;
                        case "end":
                            infoContent = `
                                <div style="font-family: Arial, sans-serif; width: 300px; border: 1px solid #ddd;">
                                    <div style="background-color: #d9edf7; padding: 10px; font-weight: bold; color: #31708f;">
                                        위치 정보
                                    </div>
                                    <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 10px; font-size: 14px;">
                                        <tr>
                                            <td style="padding: 5px; border-bottom: 1px solid #ddd; width: 30%; font-weight: bold;">위치명</td>
                                            <td style="padding: 5px; border-bottom: 1px solid #ddd;">${title}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 5px; border-bottom: 1px solid #ddd; width: 30%; font-weight: bold;">아이디</td>
                                            <td style="padding: 5px; border-bottom: 1px solid #ddd;">${key}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 5px; border-bottom: 1px solid #ddd; font-weight: bold;">위도</td>
                                            <td style="padding: 5px; border-bottom: 1px solid #ddd;">${position.lat}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 5px; font-weight: bold;">경도</td>
                                            <td style="padding: 5px;">${position.lng}</td>
                                        </tr>
                                    </table>
                                </div>
                            `;
                            break;
                        default:
                            infoContent = `
                                <div style="font-family: Arial, sans-serif; width: 300px; border: 1px solid #ddd;">
                                    <div style="background-color:rgb(217, 247, 220); padding: 10px; font-weight: bold; color:rgb(49, 143, 73);">
                                        위치 정보
                                    </div>
                                    <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 10px; font-size: 14px;">
                                        <tr>
                                            <td style="padding: 5px; border-bottom: 1px solid #ddd; width: 30%; font-weight: bold;">위치명</td>
                                            <td style="padding: 5px; border-bottom: 1px solid #ddd;">${title}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 5px; border-bottom: 1px solid #ddd; width: 30%; font-weight: bold;">아이디</td>
                                            <td style="padding: 5px; border-bottom: 1px solid #ddd;">${key}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 5px; border-bottom: 1px solid #ddd; font-weight: bold;">위도</td>
                                            <td style="padding: 5px; border-bottom: 1px solid #ddd;">${position.lat}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 5px; font-weight: bold;">경도</td>
                                            <td style="padding: 5px;">${position.lng}</td>
                                        </tr>
                                    </table>
                                </div>
                            `;
                            break;
                    }

                    // 인포윈도우 내용 설정 및 열기
                    gInfoWindow.setContent(infoContent);
                    gInfoWindow.setOptions({
                        pixelOffset: new google.maps.Size(0, -40), // 오프셋 변경
                        key: key,
                    });
                    gInfoWindow.open(gMap, marker);
                });
            });
        },

        /**
         * 마커 클릭 시 zIndex를 앞으로 설정하는 함수
         * @param {Array} markers - 생성된 마커 배열
         * @returns {void}
         */
        gfn_gMapSetZIndexOnClick(markers) {
            markers.forEach((marker) => {
                google.maps.event.addListener(marker, "click", () => {
                    // 모든 마커의 zIndex를 기본값으로 초기화
                    markers.forEach((m) => {
                        m.zIndex = 10; // 기본 zIndex
                    });
                    // 클릭된 마커의 zIndex를 가장 앞으로 설정
                    marker.zIndex = 1000;
                });
            });
        },

        /**
         * 모든 지도 정보 제거
         * - 클러스터링된 마커 및 지도 위의 모든 선과 화살표를 제거
         * @returns {void}
         */
        gfn_gMapClear() {
            //마커제거
            if (gMarkers && gMarkers.length > 0) {
                gMarkers.forEach((marker) => {
                    marker.setMap(null);
                });
                gMarkers.length = 0;
            }
            //클러스터 제거
            if (gClusterer) {
                gClusterer.clearMarkers();
            }
            this.gfn_gMapClearPolylinesAndArrows(); //선, 화살표 제거
            this.removeZoomChangedListener(); //줌변경 리스너 제거
        },

        /**
         * 지도 위의 모든 선 및 화살표 제거
         * - 지도에 추가된 모든 폴리라인과 화살표 마커를 제거
         * - 줌 변경 이벤트 리스너도 제거하여 추가 화살표 생성을 방지
         * @returns {void}
         */
        gfn_gMapClearPolylinesAndArrows() {
            // 모든 선 제거
            gPolylines.forEach((polyline) => polyline.setMap(null));
            gPolylines.length = 0; // 배열 초기화

            // 모든 화살표 제거
            gArrowMarkers.forEach((marker) => marker.setMap(null));
            gArrowMarkers.length = 0; // 배열 초기화
        },

        /**
         * 줌 변경 이벤트 리스너 제거
         * - 등록된 줌 변경 이벤트 리스너를 제거, 이벤트를 중지
         * @returns {void}
         */
        removeZoomChangedListener() {
            google.maps.event.removeListener(gZoomChangedListener);
            gZoomChangedListener = null;
        },

        /**
         * 특정 key 값 배열로 여러 마커 삭제
         * @param {Array<string>} keys - 삭제할 마커의 key 값 배열
         */
        gfn_gMapRemoveMarkerByKey(keys) {
            if (!gMarkers || gMarkers.length === 0) {
                console.warn("마커 배열이 비어 있습니다.");
                return;
            }

            if (!Array.isArray(keys) || keys.length === 0) {
                console.warn("유효한 key 배열이 전달되지 않았습니다.");
                return;
            }

            keys.forEach((key) => {
                for (let i = 0; i < gMarkers.length; i++) {
                    const marker = gMarkers[i];

                    if (marker.key === key) {
                        // 지도에서 마커 제거
                        marker.setMap(null);

                        // gMarkers 배열에서 마커 제거
                        gMarkers.splice(i, 1);

                        // 클러스터에서 마커 제거
                        if (gClusterer) {
                            gClusterer.removeMarker(marker);
                        }
                        break;
                    }
                }
            });
        },

        /**
         * 현재 오픈된 정보창 검증
         * @param {string} key - 검증할 키값
         * @returns {google.maps.InfoWindow|null} - 현재 열려있는 정보창이 키값과 일치하면 반환, 그렇지 않으면 null
         */
        gfn_gMapInfoWindowVerification(key) {
            if (gInfoWindow.isOpen && gInfoWindow.key == key) {
                return gInfoWindow.key;
            } else {
                return null;
            }
        },

        /**
         * 키값으로 마커 객체 반환
         * @param {string} key - 찾을 마커의 키값
         * @returns {google.maps.marker.AdvancedMarkerElement|null} - 키값과 일치하는 마커를 반환, 없으면 null
         */
        gfn_gMapFindMarkerByKey(key) {
            return gMarkers.find((marker) => marker.key === key);
        },

        /**
         * 특정 키값으로 정보창 열기
         * @param {string} key - 정보창을 열고자 하는 마커의 키값
         * @returns {void}
         */
        gfn_gMapOpenInfoWindow(key) {
            const marker = this.gfn_gMapFindMarkerByKey(key);

            gInfoWindow.setOptions({ disableAutoPan: true });
            google.maps.event.trigger(marker, "click");
            gInfoWindow.setOptions({ disableAutoPan: false });
        },

        /**
         * 경로 계산 및 지도에 표시 (이름 또는 위경도 기반)
         * @param {Object} obj - 경로 계산에 필요한 데이터
         * @param {Object|string} obj.startPoint - 출발지 (위경도 또는 이름)
         * @param {Object|string} obj.endPoint - 도착지 (위경도 또는 이름)
         * @param {Function} callback - 경로 계산 결과를 전달받는 콜백 함수
         * @returns {void}
         */
        gfn_gMapCalculateRoute(obj, callback) {
            // 기존 경로 및 마커 초기화
            if (gDirectionsRenderer) {
                gDirectionsRenderer.setMap(null);
                gDirectionsRenderer = null;
            }
            gRouteMarkers.forEach((marker) => marker.setMap(null));
            gRouteMarkers = [];

            const directionsService = new google.maps.DirectionsService();
            gDirectionsRenderer = new google.maps.DirectionsRenderer({
                map: gMap,
                suppressMarkers: true, // 기본 마커 숨기기
            });

            // 출발지와 도착지를 처리 (이름 또는 위경도 확인)
            //출발지
            const origin =
                typeof obj.startPoint === "string"
                    ? obj.startPoint
                    : new google.maps.LatLng(
                          obj.startPoint.lat,
                          obj.startPoint.lng
                      );
            //도착지
            const destination =
                typeof obj.endPoint === "string"
                    ? obj.endPoint
                    : new google.maps.LatLng(
                          obj.endPoint.lat,
                          obj.endPoint.lng
                      );

            const request = {
                origin, // 출발지
                destination, // 도착지
                travelMode: google.maps.TravelMode.DRIVING,
            };

            directionsService.route(request, (result, status) => {
                if (status === google.maps.DirectionsStatus.OK) {
                    gDirectionsRenderer.setDirections(result);
                    const vStartLocation =
                        result.routes[0].legs[0].start_location;
                    const vStartAddress =
                        result.routes[0].legs[0].start_address;
                    const vEndLocation = result.routes[0].legs[0].end_location;
                    const vEndAddress = result.routes[0].legs[0].end_address;

                    const routeInfo = {
                        distance: result.routes[0].legs[0].distance.text,
                        duration: result.routes[0].legs[0].duration.text,
                    };

                    //출발지 마커 설정
                    const startMarker = new google.maps.Marker({
                        position: result.routes[0].legs[0].start_location,
                        map: gMap,
                        title: "출발지",
                        icon: {
                            url: "/images/map/icon07.png",
                            scaledSize: new google.maps.Size(40, 40),
                            transform: "translate(-35%, -100%)",
                        },
                    });

                    //도착지 마커 설정
                    const endMarker = new google.maps.Marker({
                        position: result.routes[0].legs[0].end_location,
                        map: gMap,
                        title: "도착지",
                        icon: {
                            url: "/images/map/icon08.png",
                            scaledSize: new google.maps.Size(40, 40),
                            transform: "translate(-35%, -100%)",
                        },
                    });

                    /** 출발지 정보창 */
                    const startInfoContent = `
                    <div style="font-family: Arial, sans-serif; width: 350px; border: 1px solid #ddd;">
                        <div style="background-color: rgb(247, 217, 217); padding: 10px; font-weight: bold; color: rgb(143, 49, 49);">
                            출발지 정보
                        </div>
                        <p style="padding: 5px; margin: 0;">위치: ${vStartLocation}, </p>
                        <p style="padding: 5px; margin: 0;">주소: ${vStartAddress}</p>
                    </div>
                `;

                    /** 도착지 정보창 */
                    const endInfoContent = `
                    <div style="font-family: Arial, sans-serif; width: 350px; border: 1px solid #ddd;">
                        <div style="background-color: #d9edf7; padding: 10px; font-weight: bold; color: #31708f;">
                            도착지 정보
                        </div>
                        <p style="padding: 5px; margin: 0;">위치: ${vEndLocation}</p>
                        <p style="padding: 5px; margin: 0;">주소: ${vEndAddress}</p>
                    </div>
                `;

                    // 전역 정보창 재사용 (하나의 정보창만 띄우기)
                    if (!gInfoWindow) {
                        gInfoWindow = new google.maps.InfoWindow({
                            disableAutoPan: false,
                        });
                    }

                    // 출발지 마커 클릭 시 정보창 열기
                    this.gfn_gMapOnClick(startMarker, () => {
                        gInfoWindow.close(); // 기존 정보창 닫기
                        gInfoWindow.setContent(startInfoContent);
                        gInfoWindow.open(gMap, startMarker);
                    });

                    // 도착지 마커 클릭 시 정보창 열기
                    this.gfn_gMapOnClick(endMarker, () => {
                        gInfoWindow.close(); // 기존 정보창 닫기
                        gInfoWindow.setContent(endInfoContent);
                        gInfoWindow.open(gMap, endMarker);
                    });

                    gRouteMarkers.push(startMarker, endMarker);

                    if (typeof callback === "function") {
                        callback(routeInfo);
                    }
                } else {
                    this.fn_showAlert(
                        "경로를 찾을 수 없습니다. 다시 시도하세요."
                    );
                    if (typeof callback === "function") {
                        callback(null);
                    }
                }
            });
        },

        /**
         * 출발지 및 도착지 자동완성 (input keyIn)
         * @param {string} inputId - 자동완성을 적용할 input ID
         * @param {Function} callback - 위치 선택 후 실행할 콜백 함수
         */
        gfn_gMapInitAutocomplete(inputId, callback) {
            const inputElement = document.getElementById(inputId);
            if (!inputElement) {
                console.error(`입력 필드가 존재하지 않습니다: ${inputId}`);
                return;
            }

            // Google Places Autocomplete 초기화
            // 관련URL : https://developers.google.com/maps/documentation/javascript/place-autocomplete?hl=ko
            const autocomplete = new google.maps.places.Autocomplete(
                inputElement,
                {
                    fields: [
                        "address_components",
                        "formatted_address",
                        "geometry",
                        "name",
                    ],
                }
            );

            // 자동완성된 장소 선택 시 실행
            autocomplete.addListener("place_changed", () => {
                const place = autocomplete.getPlace();
                console.log("place", place);
                if (!place.geometry || !place.geometry.location) {
                    alert("유효한 장소를 선택해주세요.");
                    return;
                }

                const location = {
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng(),
                    address: place.formatted_address,
                    name: place.name,
                };

                // 콜백 함수 실행 (선택한 위치 정보 전달)
                if (typeof callback === "function") {
                    callback(location);
                }
            });
        },
    },
};
