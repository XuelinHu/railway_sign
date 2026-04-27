export const DEMO_SCENARIO = {
  regionName: '铁路信号设备数字孪生系统',
  intervalName: '1491-1497 区间演示',
  stationStart: '1491',
  stationEnd: '1497',
  railwayName: '铁路信号设备数字孪生系统',
  weatherLocation: '铁路沿线',
  heroDeviceName: '1495信号机',
  humidityIncident: {
    title: '环境湿度预警',
    alarmContent: '箱体内部湿度偏高，建议巡检密封状态。',
    analysis: '当前为演示数据，用于联动孪生面板的环境异常提示。',
    suggestion: '建议核查箱体密封、引线接头与排水条件。'
  },
  nearbyStations: {
    main: '1495信号机',
    freight: '1493信号机',
    hs: '1497信号机'
  }
}

export default DEMO_SCENARIO
