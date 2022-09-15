function getDrawTime (origin) {
  const timeUps = {
      '0-1': 2, 
      '0-2': 2,
      '1-1': 1,
      '1-2': 2,
      '2-1': 1,
      '2-2': 2,
      '3-1': 1,
      '3-2': 2,
      '4-1': 1,
      '4-2': 4,
      '5-1': 3,
      '5-2': 4,
      '6-1': 3,
      '6-2': 3,
  }
  const originObj = new Date(origin)
  const timeObj = new Date(+originObj.getTime()+9*3600*1000)
  const timeForGet = new Date(+originObj.getTime()+1*3600*1000)
  const secondKey = timeForGet.getHours() <= 11 ? 1 : 2
  const keyName = `${timeForGet.getDay()}-${secondKey}`
  const addTime = timeUps[keyName] * 24 * 3600 * 1000
  const finalTimeStamp = timeObj.getTime() + addTime
  const originTime = new Date(+originObj.getTime()+9*3600*1000).toISOString().replace(/T/g,' ').replace(/\.[\d]{3}Z/,'')
  const finalTime = new Date(finalTimeStamp).toISOString().replace(/T/g,' ').replace(/\.[\d]{3}Z/,'')
  return {
    originTime,
    draw: `${finalTime.split(/\s+/)[0]} 09:00:00`
  }
}

const res = getDrawTime(input.time)


output = {
  originTime: res.originTime,
  draw: res.draw
}