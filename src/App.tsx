import React, { useEffect, useState } from 'react';
import axios from 'axios';
import OpenSeaDragonViewer from './OpenSeaDragonViewer';
import './App.css';

import { XMLParser } from 'fast-xml-parser';

const App: React.FC = () => {
  const xmlFile = './xml/samp.xml';

  const [allData, setAllData] = useState<any>(null);
  const [tileSourcesArray, setTileSourcesArray] = useState<{ type: string; url: string }[]>([]);

  const [totalPage, setTotalPage] = useState<number>(0);

  const [msg, setMsg] = useState<string>('');

  useEffect(() => {

    const initialize = async () => {
      try{
        setMsg('データ読み込み中です');

        const response = await axios.get(xmlFile);
        const parser = new XMLParser({ ignoreAttributes: false });
        const xmlData = parser.parse(response.data);
        const data = xmlData.OCRDATASET.PAGE;

        setAllData(data)

        // 総ページ数の設定
        setTotalPage(data.length);

        //tileSource
        const tileSources = data.map((page:any) => ({
          type: 'image',
          url: `./data/${page['@_IMAGENAME']}`,
        }));
        setTileSourcesArray(tileSources);

        setMsg('');
      }catch(error){
        setMsg('データの読み込みに失敗しました');
        console.log(error)
      }
    };
    initialize();
  },[]);

  return (
    <OpenSeaDragonViewer
      imageUrl={tileSourcesArray}
      loadingMsg={msg}
      totalPage={totalPage}
      getData={allData}
    />
  );
};

export default App;
