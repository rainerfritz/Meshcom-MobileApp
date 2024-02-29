// Tables with the aprs symbols
  export interface aprs_char_table {
    s_name:string,
    s_char:string
  }

  export const aprs_pri_symbols : aprs_char_table [] =
  [
    
    {
      s_name:"Runner",
      s_char:"["
    },
    {
      s_name:"House",
      s_char:"-"
    },
    {
      s_name:"Motorcycle",
      s_char:"<"
    },
    {
      s_name:"Car",
      s_char:">"
    },
    {
      s_name:"Bike",
      s_char:"b"
    },
    {
      s_name:"Truck",
      s_char:"u"
    },
    {
      s_name:"Van",
      s_char:"v"
    },
    {
      s_name:"Ship / Boat",
      s_char:"s"
    },
    {
      s_name:"Aircraft",
      s_char:"^"
    },
    {
      s_name:"Balloon",
      s_char:"O"
    },
    {
      s_name:"Yacht",
      s_char:"Y"
    },
    {
      s_name:"Star",
      s_char:"#"
    },
    {
      s_name:"WX Station",
      s_char:"_"
    },
    
  ] 

  export const aprs_sec_symbols : aprs_char_table [] =
  [
    {
      s_name:"EMERGENCY",
      s_char:"!"
    },
    {
      s_name:"CLOUDY",
      s_char:"("
    },
    {
      s_name:"SNOW",
      s_char:"*"
    },
    {
      s_name:"Flooding",
      s_char:"w"
    },
    {
      s_name:"SUNNY",
      s_char:"U"
    },
    {
      s_name:"Church",
      s_char:"+"
    },
    {
      s_name:"Gas Station",
      s_char:"9"
    },
    {
      s_name:"Park",
      s_char:";"
    },
    {
      s_name:"HURICANE",
      s_char:"@"
    },
    {
      s_name:"Lighthouse",
      s_char:"L"
    },
    {
      s_name:"Restaurant",
      s_char:"R"
    },
    {
      s_name:"WorkZone",
      s_char:"j"
    }
    
  ] 