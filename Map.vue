<template>
    <div class="layout-container">
      <div class="sidebar">
        <div class="logo">
          LKICT
        </div>
        <form class="search-form" ref="searchForm" autocomplete="off">
          <button type="button" @click="toggleAutoUpdate">
            <div class="tooltip-container">
              <span>자동 갱신 {{ isUpdating ? '중지' : '시작' }}</span>
              <span class="tooltip-text">
                <p>자동갱신주기는 기본설정 3초이지만</p>
                <p>
                  대용량 데이터 추가 버튼 클릭시 30초로 늘어납니다
                </p>
              </span>
            </div>
          </button>
          <button type="button" @click="delBtnOnClick">전체삭제</button>
          <button type="button" @click="delLineBtnOnClick">선삭제</button>
          <button type="button" @click="delMarkerBtnOnClick">특정 마커삭제</button>
          <button type="button" @click="refBtnOnClick">지도새로고침</button>
          <button type="button" @click="bigDataBtnOnClick" :disabled="!bigDataBtnClickYn || isUpdating">대용량 데이터
          </button>
        </form>
        <div>
          <button id='routeBtn' @click="findRoute">경로 계산</button>
        </div>
        <div class="routeLabel">
          <label for="start-location">출발지 </label>
          <input class="labelStyle" id="start-location" v-model="startPointStr" placeholder="출발지" />
        </div>
        <div class="routeLabel">
          <label for="end-location">도착지 </label>
          <input class="labelStyle" id="end-location" v-model="endPointStr" placeholder="목적지" />
          <p>출발지 위경도: {{ this.startLat }} / {{ this.startLng }} </p>
          <p>도착지 위경도: {{ this.endLat }} / {{ this.endLng }} </p>
          <p v-if="distance">경로 거리: {{ distance }} km</p>
          <p v-if="distance">경로 시간: {{ driveTime }}</p>
          <p v-if="distance">직선거리: {{ straightLine }} km</p>
        </div>
        <div>
          <h1>AUI그리드 위치</h1>
        </div>
      </div>
  
      <div class="map-container">
        <div id="map"></div>
      </div>
    </div>
  </template>
  
  <script>
  let testLat = 1;
  let updateInterval = 3000;
  /* eslint-disable */
  export default {
    name: "GoogleMapExample",
    inject: ["fn_showAlert", "fn_showConfirm"],
    methods: {
      async initialize() {
        await this.initMap(); // initMap이 완료될 때까지 대기
        this.setMap(); // initMap이 끝난 후 실행
  
        // 출발지 자동완성 설정
        this.gfn_gMapInitAutocomplete("start-location", (location) => {
          this.startLocation = location;
          this.startLat = location.lat;
          this.startLng = location.lng;
          this.startPointStr = location.address;
        });
  
        // 도착지 자동완성 설정
        this.gfn_gMapInitAutocomplete("end-location", (location) => {
          this.endLocation = location;
          this.endLat = location.lat;
          this.endLng = location.lng;
          this.endPointStr = location.address;
        });
      },
      //지도 초기화
      async initMap() {
        await this.loadGoogleLibraries(); // 구글맵 라이브러리 로드
        this.gfn_gMapCreate("map", this.options); // 맵 생성
      },
  
      //지도 정보추가
      setMap() {
        //마커데이터
        const markerData = {
          customCluster: true,
          // cluster: false, //클러스터 사용여부 default:true
          data: [
            ...this.markerData,
            ...this.DepMakerData,
            ...this.DlvryMakerData
          ],
        } 
        this.gfn_gMapCreateMarkers(markerData); // 마커 생성
        this.gfn_gMapPolylineWithDynamicArrow(this.path); //선 그리기
  
      },
  
      // 자동 갱신 토글
      toggleAutoUpdate() {
        if (this.isUpdating) {
          clearInterval(this.updateInterval);
          this.isUpdating = false;
        } else {
          this.updateInterval = setInterval(this.addData, updateInterval);
          this.isUpdating = true;
        }
      },
  
      // 데이터 추가 및 마커 갱신
      addData() {
        const key = this.gfn_gMapInfoWindowVerification("KeyId32");
        const i = Math.random() * 1000;
        const delMarkers = ["KeyId32"];
        this.gfn_gMapRemoveMarkerByKey(delMarkers);
  
        this.DlvryMakerData = []; //마지막경로만 마커를 찍을경우 초기화
        this.DlvryMakerData.push({ key: "KeyId32", position: { lat: 53.543 + testLat, lng: 9.966759 + i / 100 }, title: "Port of Hamburg" + i, type: "delivery" });
        this.path.push({ lat: 53.543 + testLat, lng: 9.9667 + i / 100 });
  
        this.setMap();
        this.gfn_gMapOpenInfoWindow(key);
  
        testLat = testLat + 0.5;
      },
  
      //전체 삭제 버튼 
      delBtnOnClick() {
        this.gfn_gMapClear();
        this.markerData = [];
        this.DepMakerData = [];
        this.DlvryMakerData = [];
        this.path = [];
      },
  
      //새로고침 버튼
      refBtnOnClick() {
        this.initialize();
      },
  
      //선삭제 버튼
      delLineBtnOnClick() {
        this.gfn_gMapClearPolylinesAndArrows();
        this.removeZoomChangedListener();
      },
  
      //특정마커 삭제 버튼
      delMarkerBtnOnClick() {
        const delMarkers = ["KeyId32", "KeyId2", "KeyId3", "KeyId4", "KeyId5", "KeyId6", "KeyId7"];
        this.gfn_gMapRemoveMarkerByKey(delMarkers);
  
        delMarkers.forEach((key) => {
          // markerData에서 해당 key를 가진 데이터 삭제
          for (let i = 0; i < this.markerData.length; i++) {
            if (this.markerData[i].key === key) {
              this.markerData.splice(i, 1);
              break;
            }
          }
        });
      },
  
      //대용량 데이터 추가
      bigDataBtnOnClick() {
        for (let i = 100; i < 5000; i++) {
          //마커 추가
          this.markerData.push({ key: `KeyId${i}`, position: { lat: 30.543764 + i / 100, lng: i / 100 }, title: `Port of Hamburg${i}`, type: "start" });
          //선추가
          // this.path.push({ lat: 53.543 + i / 1000, lng: 9.9667 + i / 1000 });
        }
        this.bigDataBtnClickYn = false;
        this.initialize();
        updateInterval = 30000;
      },
  
      // 경로계산버튼
      findRoute() {
        if (!this.startPointStr || !this.endPointStr) {
          this.fn_showAlert("출발지와 목적지를 입력하세요.");
          return;
        }
  
        const obj = {
          //위경도로 검색
          startPoint: { lat: this.startLat, lng: this.startLng },
          endPoint: { lat: this.endLat, lng: this.endLng },
          //출도착지 명칭으로 검색
          // startPoint: this.startPointStr,
          // endPoint: this.endPointStr,
        };
  
        this.gfn_gMapCalculateRoute(obj, (routeInfo) => {
          if (routeInfo) {
            this.distance = routeInfo.distance; //경로거리
            this.driveTime = routeInfo.duration; //경로 시간
            //직선거리 계산
            const distance =
              google.maps.geometry.spherical.computeDistanceBetween(
                new google.maps.LatLng(this.startLat, this.startLng),
                new google.maps.LatLng(this.endLat, this.endLng)
              );
            this.straightLine = Math.round(Math.round(distance, 2) / 1000);
  
            this.path = [];
            this.path.push({ lat: this.startLat, lng: this.startLng });
            this.path.push({ lat: this.endLat, lng: this.endLng });
            this.gfn_gMapPolyline(this.path);
          }
        });
      },
  
      fn_showTooltip() {
        this.showTooltip = !(this.showTooltip);
      },
  
    },
    mounted() {
      window['$this'] = this;
      this.initialize();
    },
    data() {
      return {
        isUpdating: false, // 자동 갱신 상태
        bigDataBtnClickYn: true, //대용량 데이터 추가 클릭 여부
        startPointStr: null, // 출발지
        endPointStr: null, // 도착지
        startPointLatLng: { lat: 53.543764, lng: 9.966759 }, //위경도로 계산용 테스트 데이터
        endPointLatLng: { lat: 53.881515, lng: 10.686556 }, //위경도로 계산용 테스트 데이터
        distance: null, // 계산된 거리
        driveTime: null, //예상시간
        straightLine: null, //직선거리
        showTooltip: false, //툴팁
        startLat: 0, //출발지 위도
        startLng: 0, //출발지 경도
        endLat: 0, //도착지 위도
        endLng: 0, //도착지 경도
        //마커데이터
        markerData: [
          { key: "KeyId1", position: { lat: 53.543764, lng: 9.966759 }, title: "Port of Hamburg", type: "start" },
          { key: "KeyId2", position: { lat: 53.5419389, lng: 8.5780500 }, title: "Port of Bremerhaven", type: "start" },
          { key: "KeyId3", position: { lat: 53.516674, lng: 8.130576 }, title: "Port of Wilhelmshaven", type: "start" },
          { key: "KeyId4", position: { lat: 53.881515, lng: 10.686556 }, title: "Port of Lübeck", type: "start" },
          { key: "KeyId5", position: { lat: 54.321674, lng: 10.135388 }, title: "Port of Kiel", type: "start" },
          { key: "KeyId63", position: { lat: 53.7100000, lng: 8.8600000 }, title: "Marker 33", type: "start" },
          { key: "KeyId64", position: { lat: 53.7150000, lng: 8.8700000 }, title: "Marker 34", type: "start" },
          { key: "KeyId65", position: { lat: 53.7200000, lng: 8.8800000 }, title: "Marker 35", type: "start" },
          { key: "KeyId66", position: { lat: 53.7250000, lng: 8.8900000 }, title: "Marker 36", type: "start" },
        ],
  
        DepMakerData: [
          { key: "KeyId22", position: { lat: 50.543764, lng: 9.966759 }, title: "Port of Hamburg1", type: "end" },
          { key: "KeyId23", position: { lat: 50.5419389, lng: 8.5780500 }, title: "Port of Bremerhaven1", type: "end" },
          { key: "KeyId24", position: { lat: 50.516674, lng: 8.130576 }, title: "Port of Wilhelmshaven1", type: "end" },
          { key: "KeyId25", position: { lat: 50.881515, lng: 10.686556 }, title: "Port of Lübeck1", type: "end" },
          { key: "KeyId26", position: { lat: 50.321674, lng: 10.135388 }, title: "Port of Kiel1", type: "end" },
          { key: "KeyId27", position: { lat: 50.150375, lng: 12.100007 }, title: "Port of Rostock1", type: "end" },
          { key: "KeyId28", position: { lat: 50.367518, lng: 7.206365 }, title: "Port of Emden1", type: "end" },
          { key: "KeyId29", position: { lat: 50.432472, lng: 6.761329 }, title: "Port of Duisburg1", type: "end" },
          { key: "KeyId30", position: { lat: 50.078419, lng: 8.798995 }, title: "Port of Bremen1", type: "end" },
          { key: "KeyId31", position: { lat: 50.308056, lng: 13.095556 }, title: "Port of Stralsund1", type: "end" },
        ],
  
        DlvryMakerData: [
          { key: "KeyId32", position: { lat: 53.113764, lng: 9.166759 }, title: "Port of Hamburg2", type: "delivery" },
        ],
  
        //선 경로
        path: [
          { lat: 53.913764, lng: 9.966759 },
          { lat: 53.813764, lng: 9.966759 },
          { lat: 53.713764, lng: 9.936759 },
          { lat: 53.613764, lng: 9.926759 },
          { lat: 53.513764, lng: 9.986759 },
          { lat: 53.413764, lng: 10.166759 },
          { lat: 53.313764, lng: 9.366759 },
          { lat: 53.213764, lng: 9.066759 },
          { lat: 53.113764, lng: 9.166759 },
        ],
  
      }
    }
  };
  </script>
  
  <style>
  #map {
    width: 100%;
    height: 500px;
  }
  
  body {
    margin: 0;
    font-family: Arial, sans-serif;
  }
  
  .layout-container {
    display: flex;
    height: 100vh;
  }
  
  .sidebar {
    width: 25%;
    background-color: #f8f9fa;
    padding: 20px;
    box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
    overflow-y: auto;
  }
  
  .logo {
    font-size: 1.5rem;
    font-weight: bold;
    margin-bottom: 20px;
  }
  
  .search-form label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
  }
  
  .search-form input,
  .search-form select {
    width: 100%;
    padding: 10px;
    margin-bottom: 10px;
    border: 1px solid #ddd;
    border-radius: 5px;
  }
  
  .search-form button {
    width: 33%;
    padding: 10px;
    margin-bottom: 10px;
    border: 1px solid #ddd;
    border-radius: 5px;
  }
  
  .map-container {
    flex: 1;
    position: relative;
  }
  
  #map {
    width: 100%;
    height: 100%;
  }
  
  button:disabled {
    background-color: #d3d3d3;
    color: #a9a9a9;
    cursor: not-allowed;
  }
  
  #routeBtn {
    margin-bottom: 10px;
    background-color: darkcyan;
    color: white;
    border: none;
    padding: 5px 15px;
    text-align: center;
    text-decoration: none;
    display: inline-block;
    font-size: 15px;
    cursor: pointer;
    transition-duration: 0.4s;
    margin-right: 3px;
  }
  
  /* 툴팁 스타일 */
  .tooltip-container {
    position: relative;
    display: inline-block;
  }
  
  .tooltip-text {
    visibility: hidden;
    width: 350px;
    background-color: #333;
    color: #fff;
    text-align: center;
    border-radius: 5px;
    padding: 8px;
    position: absolute;
    bottom: 140%;
    left: 150%;
    /* 버튼 위에 위치 */
    transform: translateX(-50%);
    z-index: 10;
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
    font-size: 14px;
    white-space: nowrap;
  }
  
  /* 툴팁 화살표 */
  .tooltip-text::after {
    content: "";
    position: absolute;
    top: 100%;
    /* 버튼 아래쪽 */
    left: 5%;
    margin-left: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: #333 transparent transparent transparent;
  }
  
  /* 툴팁 활성화 */
  .tooltip-container:hover .tooltip-text,
  .tooltip-container:focus-within .tooltip-text {
    visibility: visible;
    opacity: 1;
  }
  
  /* 툴팁 버튼 */
  .tooltip-toggle {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    transition: background 0.3s ease;
  }
  
  .tooltip-toggle:hover {
    background-color: #f0f0f0;
  }
  
  .routeLabel {
    font-weight: bold;
    font-size: 14px;
  }
  
  .labelStyle {
    width: 80%;
    margin-bottom: 15px;
  }
  </style>
  