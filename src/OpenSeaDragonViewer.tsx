import React, { useEffect, useRef , useState} from 'react';
import OpenSeadragon from 'openseadragon';

interface OpenSeaDragonViewerProps {
  getData:any[];
  imageUrl: { type: string; url: string }[];
  loadingMsg:string;
  totalPage:number
}

const OpenSeaDragonViewer: React.FC<OpenSeaDragonViewerProps> = ({
   imageUrl ,
   loadingMsg,
   totalPage,
   getData
  }) => {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const osdViewer = useRef<OpenSeadragon.Viewer | null>(null);

  const msgRef = useRef<HTMLDivElement | null>(null);

  const [allData, setAllData] = useState<any[]>([]);
  const [filteringData, setFilteringData] = useState<any[]>([]);//検索結果

  const [searchKw,setSearchKw] = useState<string>('');//検索ワード

  const [currentPage,setCurrentPage] = useState<number>(0);//表示頁
  const [selectedPage,setSelectedPage] = useState<string>('1');//ボックスの頁

  const [inactive,setInactive] = useState<string>('');
  const [sideFlg,setSideFlg] = useState<string>('');
  const [selectedFlg,setSelectedFlg] = useState<string>('');

  const [msg, setMsg] = useState<string>('');

  useEffect(() => {
    if (getData && getData.length > 0) {//データ取得確認
      //階層を揃える
      const transformedData = getData.map((item:any) => {
        const allLines = [
          ...(Array.isArray(item.TEXTBLOCK) ? item.TEXTBLOCK.flatMap((block: any) => block.LINE) : []),
          ...(Array.isArray(item.LINE) ? item.LINE : []),
        ];
        return{
          LINE:allLines,
          WIDTH: Number(item["@_WIDTH"]),
          HEIGHT: Number(item["@_HEIGHT"])
        };
      });
      setAllData(transformedData);
      setFilteringData(transformedData);
    }
  },[getData]);

  useEffect(() => {
    if (viewerRef.current && imageUrl && imageUrl.length > 0) {
      if (osdViewer.current) {
        osdViewer.current.destroy();
      }
      osdViewer.current = OpenSeadragon({
        element: viewerRef.current,
        //prefixUrl: "https://openseadragon.github.io/openseadragon/images/",
        prefixUrl: "./images/",
        tileSources: imageUrl as any,
        showRotationControl: true,
        sequenceMode: true,
        showNavigator: true,
        fullPageButton: "fullscreen",
        rotateLeftButton: "rotate-left",
        rotateRightButton: "rotate-right",
        zoomInButton: "zoom-in",
        zoomOutButton: "zoom-out",
        homeButton: "reset",
        nextButton: "next",
        previousButton: "previous",
      });

      //ページ遷移
      osdViewer.current.addHandler('page', () => {
        getPage();
      })

    }
    return () => {
      if (osdViewer.current) {
        osdViewer.current?.destroy();
      }
    };
  }, [imageUrl]);

  useEffect(() => {
    let touchStartX = 0;
    let touchEndX = 0;
  
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX;
    };
  
    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipeGesture();
    };
  
    const handleSwipeGesture = () => {
      const threshold = 50; // スワイプのしきい値
      if (touchStartX - touchEndX > threshold) {
        // 左にスワイプ → 次ページ
        toNextPage();
      } else if (touchEndX - touchStartX > threshold) {
        // 右にスワイプ → 前ページ
        handlePrevious();
      }
    };
  
    const viewerElement = viewerRef.current;
    if (viewerElement) {
      viewerElement.addEventListener('touchstart', handleTouchStart, { passive: true });
      viewerElement.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
  
    // クリーンアップ
    return () => {
      if (viewerElement) {
        viewerElement.removeEventListener('touchstart', handleTouchStart);
        viewerElement.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [viewerRef.current]);
  

  //入力ボックス値（頁）
  const handleChangePage = (e:React.ChangeEvent<HTMLInputElement>)=>{
    setSelectedPage(e.target.value);
  }

  //検索
  const isSearch = (w?:string) =>{
    let data = allData;
    let kw = searchKw.trim();//前後の空白を削除

    if(w !== undefined && w !== null){
      kw = w;
    }
    if(!kw){
      setMsg('キーワードを入力して下さい');
      setSideFlg('');
      return;
    }
    //検索語チェック
    kw = kw.replace(/[<>'&"/\u3000]/g, " ");

    let kwsArray =kw.split(' ').filter(Boolean);

    //正規化処理
    kwsArray = kwsArray.map(keyword => laceAllByConvertTable(keyword));

    //キーワード検索
    const isMatch = (line: any) =>
      kwsArray.every(keyword =>
        laceAllByConvertTable(line['@_STRING']).includes(keyword)
      );

      const filteredArry = data.map(pa => ({
        ...pa,
        LINE: pa.LINE.filter(isMatch)
      }));

      setFilteringData(filteredArry);
      const hitCount = filteredArry.reduce((acc, pa) => acc + pa.LINE.length, 0);
      if (hitCount === 0) {
        setMsg('該当ワードはありません');
      }
      if(hitCount === 0){
        setSideFlg('')
      }else{
        setSideFlg('result');
      }
      //オーバーレイ削除
      execRemoveOverlay();

      //先頭ページへ
      toPage(0);

      //サイド先頭位置へ
      const posId =document.getElementById('txt0');
      if(posId){
        posId.scrollIntoView({behavior:'smooth',block:'start'});
      }
  }

  //ページ遷移
  const toPage =(p:number, x?: number, y?: number, w?: number, h?: number, idx?: number)=>{
    const viewer =osdViewer.current;
    if(viewer){
      viewer.goToPage(p);
      getPage();
      //該当画像幅取得
      const iw =allData[p].WIDTH;

      //オーバーレイ位置とサイズの計算
      const ox = (x ?? 0) / iw;
      const oy = (y ?? 0) / iw;
      const ow = (w ?? 0) / iw;
      const oh = (h ?? 0) / iw;

      //オーバーレイが既に存在する場合は削除
      if(viewer.getOverlayById('runtime-overlay')){
        viewer.removeOverlay('runtime-overlay');
      }

      //新しいオーバーレイ作成
      const elt = document.createElement('div');
      elt.id = 'runtime-overlay';
      elt.className = 'current-ocr';

      //オーバーレイの追加
      viewer.addOverlay({
        element: elt,
        location: new OpenSeadragon.Rect(ox, oy, ow, oh),
      });

      //選択フラグの設定
      setSelectedFlg(`${String(p)}_${String(idx)}`);

      //ページ取得
      getPage();
    }
  }
  //表示ページ取得
  const getPage =()=>{
    if(osdViewer.current){
      const p=osdViewer.current.currentPage();
      setCurrentPage(p);
      setSelectedPage(String(p + 1));//box表示用

      if(p === 0){
        setInactive('first');
      }else if(p === totalPage - 1){
        setInactive('last');
      }else{
        setInactive('');
      }

    }
  }
  //入力チェック（頁）
  const checkSetPage = ()=>{
    setMsg('');

    const pageMsg = `1～${totalPage}の間の数字を入力して下さい`;
    const setPage = Number(selectedPage);

    if(!isNaN(setPage)){
      if(setPage >= 1 && setPage <= totalPage){
        toPage(Number(selectedPage) - 1);
      }else{
        setMsg(pageMsg);
      }
    }else{
      setMsg(pageMsg)
    }
  }

  //次へ
  const toNextPage = () => {
    if (osdViewer.current) {
      const viewer = osdViewer.current;
      const currentPage = viewer.currentPage();
      if (currentPage < imageUrl.length - 1) {
        viewer.goToPage(currentPage + 1);
        execRemoveOverlay();
      }
    }
  }
  //前へ
  const handlePrevious = () => {
    if (osdViewer.current) {
      const viewer = osdViewer.current;
      const currentPage = viewer.currentPage();
      if (currentPage > 0) {
        viewer.goToPage(currentPage - 1);
        execRemoveOverlay();
      }
    }
  }
  // キーボード操作によるページ遷移
  const handleKeyDown = (e: KeyboardEvent) => {
    if (osdViewer.current) {
      const currentPage = osdViewer.current.currentPage();

      if (e.key === 'ArrowRight') {
        if (currentPage < totalPage - 1) {
          osdViewer.current.goToPage(currentPage + 1);
          getPage();
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentPage > 0) {
          osdViewer.current.goToPage(currentPage - 1);
          getPage();
        }
      }
    }
  }
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    }
  },[[totalPage]]);

  //リセット
  const isReset = () =>{
    toPage(0);//1ページ目へ
    setSearchKw('');//キーワード空へ
    setSideFlg('');
    setMsg('');

    //オーバーレイ削除
    execRemoveOverlay();

    getPage()
  }
  //フォーカス（アクセシビリティ対応）
  const toFocus = () =>{
    //メッセージがある場合は、メッセージにフォーカス
    if (msg) {
      msgRef.current?.focus();
    }
  }
  //パラメータチェック
  const paramsCheck = () =>{
    let initIndex = 0;
    let urlParams = new URLSearchParams(window.location.search);

    // クエリパラメータの取得とチェック
    let pagecode = urlParams.has('pagecode') ? parseInt(urlParams.get('pagecode') ?? '', 10) || null : null;
    let p = urlParams.has('p') ? parseInt(urlParams.get('p') ?? '', 10) || null : null;
    let word: string | null = urlParams.get('word') ?? null; // `null` のまま保持

    // ページの初期インデックスを設定
    if (!pagecode && !p) {
      initIndex = 0;
    }else{
      if (p) {
        initIndex = p;
      }else if(pagecode){
        initIndex = pagecode;
      }

      initIndex--; // インデックス調整

      //ページ範囲チェック
      if(!(initIndex >= 0 && initIndex < totalPage)){
        initIndex=0;
      }

      //キーワード検索処理
      if(word){
        isSearch(word);
      }

      toPage(initIndex);
    }
  }
  //オーバーレイを削除
  const execRemoveOverlay =() =>{
    const viewer = osdViewer.current;
    if(viewer){
      viewer.removeOverlay('runtime-overlay');
      setSelectedFlg('');
    }
  }
  //文字の正規化
  const laceAllByConvertTable =(searchWords:string) =>{
    //一般的な正規化や行端のスペース除去処理
    let res: string = searchWords || '';
    res = res.toUpperCase();
    res = res.trim();

    //置換テーブル1
    res = res.replaceAll('&nbsp;',' ');
    res = res.replaceAll('&ensp;',' ');
    res = res.replaceAll('&emsp;',' ');
    res = res.replaceAll('&thinsp;',' ');
    res = res.replaceAll('!',' ');
    res = res.replaceAll('"',' ');
    res = res.replaceAll('#',' ');
    res = res.replaceAll('$',' ');
    res = res.replaceAll('%',' ');
    res = res.replaceAll('&',' ');
    res = res.replaceAll("'",' ');
    res = res.replaceAll('(',' ');
    res = res.replaceAll(')',' ');
    res = res.replaceAll('*',' ');
    res = res.replaceAll('+',' ');
    res = res.replaceAll(',',' ');
    res = res.replaceAll('-',' ');
    res = res.replaceAll('/',' ');
    res = res.replaceAll('[',' ');
    res = res.replaceAll('\\',' ');
    res = res.replaceAll(']',' ');
    res = res.replaceAll('^',' ');
    res = res.replaceAll('_',' ');
    res = res.replaceAll('`',' ');
    res = res.replaceAll(':',' ');
    res = res.replaceAll(';',' ');
    res = res.replaceAll('<',' ');
    res = res.replaceAll('=',' ');
    res = res.replaceAll('>',' ');
    res = res.replaceAll('?',' ');
    res = res.replaceAll('@',' ');
    res = res.replaceAll('{',' ');
    res = res.replaceAll('|',' ');
    res = res.replaceAll('}',' ');
    res = res.replaceAll('~',' ');
    res = res.replaceAll('¡',' ');
    res = res.replaceAll('¢',' ');
    res = res.replaceAll('£',' ');
    res = res.replaceAll('¤',' ');
    res = res.replaceAll('¥',' ');
    res = res.replaceAll('¦',' ');
    res = res.replaceAll('§',' ');
    res = res.replaceAll('¨',' ');
    res = res.replaceAll('©',' ');
    res = res.replaceAll('«',' ');
    res = res.replaceAll('¬',' ');
    res = res.replaceAll('®',' ');
    res = res.replaceAll('°',' ');
    res = res.replaceAll('±',' ');
    res = res.replaceAll('´',' ');
    res = res.replaceAll('μ',' ');
    res = res.replaceAll('¶',' ');
    res = res.replaceAll('»',' ');
    res = res.replaceAll('¿',' ');
    res = res.replaceAll('×',' ');
    res = res.replaceAll('÷',' ');
    res = res.replaceAll('̀',' ');
    res = res.replaceAll('́',' ');
    res = res.replaceAll('̂',' ');
    res = res.replaceAll('̃',' ');
    res = res.replaceAll('̄',' ');
    res = res.replaceAll('̇',' ');
    res = res.replaceAll('̈',' ');
    res = res.replaceAll('̌',' ');
    res = res.replaceAll('Ъ',' ');
    res = res.replaceAll('Ь',' ');
    res = res.replaceAll('ъ',' ');
    res = res.replaceAll('ь',' ');
    res = res.replaceAll('‐',' ');
    res = res.replaceAll('—',' ');
    res = res.replaceAll('―',' ');
    res = res.replaceAll('‖',' ');
    res = res.replaceAll('‘',' ');
    res = res.replaceAll('’',' ');
    res = res.replaceAll('‚',' ');
    res = res.replaceAll('‛',' ');
    res = res.replaceAll('“',' ');
    res = res.replaceAll('”',' ');
    res = res.replaceAll('„',' ');
    res = res.replaceAll('‟',' ');
    res = res.replaceAll('†',' ');
    res = res.replaceAll('‡',' ');
    res = res.replaceAll('‥',' ');
    res = res.replaceAll('…',' ');
    res = res.replaceAll('‰',' ');
    res = res.replaceAll('′',' ');
    res = res.replaceAll('″',' ');
    res = res.replaceAll('‵',' ');
    res = res.replaceAll('‶',' ');
    res = res.replaceAll('※',' ');
    res = res.replaceAll('‾',' ');
    res = res.replaceAll('℃',' ');
    res = res.replaceAll('℉',' ');
    res = res.replaceAll('№',' ');
    res = res.replaceAll('℡',' ');
    res = res.replaceAll('Å',' ');
    res = res.replaceAll('←',' ');
    res = res.replaceAll('↑',' ');
    res = res.replaceAll('→',' ');
    res = res.replaceAll('↓',' ');
    res = res.replaceAll('↔',' ');
    res = res.replaceAll('⇄',' ');
    res = res.replaceAll('⇒',' ');
    res = res.replaceAll('⇔',' ');
    res = res.replaceAll('⇨',' ');
    res = res.replaceAll('∀',' ');
    res = res.replaceAll('∂',' ');
    res = res.replaceAll('∃',' ');
    res = res.replaceAll('∇',' ');
    res = res.replaceAll('∈',' ');
    res = res.replaceAll('∋',' ');
    res = res.replaceAll('∑',' ');
    res = res.replaceAll('−',' ');
    res = res.replaceAll('√',' ');
    res = res.replaceAll('∝',' ');
    res = res.replaceAll('∞',' ');
    res = res.replaceAll('∟',' ');
    res = res.replaceAll('∠',' ');
    res = res.replaceAll('∥',' ');
    res = res.replaceAll('∧',' ');
    res = res.replaceAll('∨',' ');
    res = res.replaceAll('∩',' ');
    res = res.replaceAll('∪',' ');
    res = res.replaceAll('∫',' ');
    res = res.replaceAll('∬',' ');
    res = res.replaceAll('∮',' ');
    res = res.replaceAll('∴',' ');
    res = res.replaceAll('∵',' ');
    res = res.replaceAll('∽',' ');
    res = res.replaceAll('≒',' ');
    res = res.replaceAll('≠',' ');
    res = res.replaceAll('≡',' ');
    res = res.replaceAll('≦',' ');
    res = res.replaceAll('≧',' ');
    res = res.replaceAll('≪',' ');
    res = res.replaceAll('≫',' ');
    res = res.replaceAll('⊂',' ');
    res = res.replaceAll('⊃',' ');
    res = res.replaceAll('⊆',' ');
    res = res.replaceAll('⊇',' ');
    res = res.replaceAll('⊥',' ');
    res = res.replaceAll('⊿',' ');
    res = res.replaceAll('⌒',' ');
    res = res.replaceAll('■',' ');
    res = res.replaceAll('□',' ');
    res = res.replaceAll('▲',' ');
    res = res.replaceAll('△',' ');
    res = res.replaceAll('▷',' ');
    res = res.replaceAll('▼',' ');
    res = res.replaceAll('▽',' ');
    res = res.replaceAll('◆',' ');
    res = res.replaceAll('◇',' ');
    res = res.replaceAll('○',' ');
    res = res.replaceAll('◎',' ');
    res = res.replaceAll('●',' ');
    res = res.replaceAll('◯',' ');
    res = res.replaceAll('★',' ');
    res = res.replaceAll('☆',' ');
    res = res.replaceAll('♀',' ');
    res = res.replaceAll('♂',' ');
    res = res.replaceAll('♠',' ');
    res = res.replaceAll('♡',' ');
    res = res.replaceAll('♣',' ');
    res = res.replaceAll('♥',' ');
    res = res.replaceAll('♦',' ');
    res = res.replaceAll('♪',' ');
    res = res.replaceAll('♭',' ');
    res = res.replaceAll('♯',' ');
    res = res.replaceAll('　',' ');
    res = res.replaceAll('、',' ');
    res = res.replaceAll('。',' ');
    res = res.replaceAll('〃',' ');
    res = res.replaceAll('〆',' ');
    res = res.replaceAll('〇',' ');
    res = res.replaceAll('〈',' ');
    res = res.replaceAll('〉',' ');
    res = res.replaceAll('《',' ');
    res = res.replaceAll('》',' ');
    res = res.replaceAll('「',' ');
    res = res.replaceAll('」',' ');
    res = res.replaceAll('『',' ');
    res = res.replaceAll('』',' ');
    res = res.replaceAll('【',' ');
    res = res.replaceAll('】',' ');
    res = res.replaceAll('〒',' ');
    res = res.replaceAll('〔',' ');
    res = res.replaceAll('〕',' ');
    res = res.replaceAll('〖',' ');
    res = res.replaceAll('〗',' ');
    res = res.replaceAll('〘',' ');
    res = res.replaceAll('〙',' ');
    res = res.replaceAll('〚',' ');
    res = res.replaceAll('〛',' ');
    res = res.replaceAll('〜',' ');
    res = res.replaceAll('〝',' ');
    res = res.replaceAll('〞',' ');
    res = res.replaceAll('〟',' ');
    res = res.replaceAll('゛',' ');
    res = res.replaceAll('゜',' ');
    res = res.replaceAll('・',' ');
    res = res.replaceAll('！',' ');
    res = res.replaceAll('＂',' ');
    res = res.replaceAll('＃',' ');
    res = res.replaceAll('＄',' ');
    res = res.replaceAll('％',' ');
    res = res.replaceAll('＆',' ');
    res = res.replaceAll('＇',' ');
    res = res.replaceAll('（',' ');
    res = res.replaceAll('）',' ');
    res = res.replaceAll('＊',' ');
    res = res.replaceAll('＋',' ');
    res = res.replaceAll('，',' ');
    res = res.replaceAll('－',' ');
    res = res.replaceAll('／',' ');
    res = res.replaceAll('：',' ');
    res = res.replaceAll('；',' ');
    res = res.replaceAll('＜',' ');
    res = res.replaceAll('＝',' ');
    res = res.replaceAll('＞',' ');
    res = res.replaceAll('？',' ');
    res = res.replaceAll('＠',' ');
    res = res.replaceAll('［',' ');
    res = res.replaceAll('＼',' ');
    res = res.replaceAll('］',' ');
    res = res.replaceAll('＾',' ');
    res = res.replaceAll('＿',' ');
    res = res.replaceAll('｀',' ');
    res = res.replaceAll('｛',' ');
    res = res.replaceAll('｜',' ');
    res = res.replaceAll('｝',' ');
    res = res.replaceAll('～',' ');
    res = res.replaceAll('｟',' ');
    res = res.replaceAll('｠',' ');
    res = res.replaceAll('｡',' ');
    res = res.replaceAll('｢',' ');
    res = res.replaceAll('｣',' ');
    res = res.replaceAll('､',' ');
    res = res.replaceAll('･',' ');
    res = res.replaceAll('￠',' ');
    res = res.replaceAll('￡',' ');
    res = res.replaceAll('￣',' ');
    res = res.replaceAll('￥',' ');

    //置換テーブル2
    res = res.replaceAll('亞', '亜');
    res = res.replaceAll('啞', '唖');
    res = res.replaceAll('龝', '穐');
    res = res.replaceAll('惡', '悪');
    res = res.replaceAll('蘆', '芦');
    res = res.replaceAll('鰺', '鯵');
    res = res.replaceAll('杍', '梓');
    res = res.replaceAll('壓', '圧');
    res = res.replaceAll('蝱', '虻');
    res = res.replaceAll('菴', '庵');
    res = res.replaceAll('葊', '庵');
    res = res.replaceAll('盦', '庵');
    res = res.replaceAll('桉', '案');
    res = res.replaceAll('㠯', '以');
    res = res.replaceAll('圍', '囲');
    res = res.replaceAll('爲', '為');
    res = res.replaceAll('醫', '医');
    res = res.replaceAll('毉', '医');
    res = res.replaceAll('毓', '育');
    res = res.replaceAll('壹', '壱');
    res = res.replaceAll('逸', '逸');
    res = res.replaceAll('稻', '稲');
    res = res.replaceAll('飮', '飲');
    res = res.replaceAll('婬', '淫');
    res = res.replaceAll('𦹥', '蔭');
    res = res.replaceAll('䕃', '蔭');
    res = res.replaceAll('𨼲', '蔭');
    res = res.replaceAll('阴', '陰');
    res = res.replaceAll('隂', '陰');
    res = res.replaceAll('侌', '陰');
    res = res.replaceAll('阥', '陰');
    res = res.replaceAll('隱', '隠');
    res = res.replaceAll('乚', '隠');
    res = res.replaceAll('韵', '韻');
    res = res.replaceAll('𡧃', '宇');
    res = res.replaceAll('㝢', '宇');
    res = res.replaceAll('夘', '卯');
    res = res.replaceAll('闚', '窺');
    res = res.replaceAll('丒', '丑');
    res = res.replaceAll('噓', '嘘');
    res = res.replaceAll('鬱', '欝');
    res = res.replaceAll('廐', '厩');
    res = res.replaceAll('廏', '厩');
    res = res.replaceAll('閠', '閏');
    res = res.replaceAll('睿', '叡');
    res = res.replaceAll('壡', '叡');
    res = res.replaceAll('營', '営');
    res = res.replaceAll('暎', '映');
    res = res.replaceAll('曵', '曳');
    res = res.replaceAll('榮', '栄');
    res = res.replaceAll('荣', '栄');
    res = res.replaceAll('偀', '英');
    res = res.replaceAll('衞', '衛');
    res = res.replaceAll('咏', '詠');
    res = res.replaceAll('驛', '駅');
    res = res.replaceAll('謁', '謁');
    res = res.replaceAll('猒', '厭');
    res = res.replaceAll('圓', '円');
    res = res.replaceAll('焱', '炎');
    res = res.replaceAll('焰', '焔');
    res = res.replaceAll('燄', '焔');
    res = res.replaceAll('㷔', '焔');
    res = res.replaceAll('熖', '焔');
    res = res.replaceAll('烟', '煙');
    res = res.replaceAll('𤇆', '煙');
    res = res.replaceAll('猨', '猿');
    res = res.replaceAll('緣', '縁');
    res = res.replaceAll('艷', '艶');
    res = res.replaceAll('豔', '艶');
    res = res.replaceAll('鹽', '塩');
    res = res.replaceAll('𦣪', '塩');
    res = res.replaceAll('汙', '汚');
    res = res.replaceAll('奧', '奥');
    res = res.replaceAll('徃', '往');
    res = res.replaceAll('應', '応');
    res = res.replaceAll('橫', '横');
    res = res.replaceAll('歐', '欧');
    res = res.replaceAll('毆', '殴');
    res = res.replaceAll('鶯', '鴬');
    res = res.replaceAll('鸎', '鴬');
    res = res.replaceAll('鷗', '鴎');
    res = res.replaceAll('黃', '黄');
    res = res.replaceAll('崗', '岡');
    res = res.replaceAll('冲', '沖');
    res = res.replaceAll('藡', '荻');
    res = res.replaceAll('溫', '温');
    res = res.replaceAll('穩', '穏');
    res = res.replaceAll('假', '仮');
    res = res.replaceAll('價', '価');
    res = res.replaceAll('禍', '禍');
    res = res.replaceAll('芲', '花');
    res = res.replaceAll('蘤', '花');
    res = res.replaceAll('譁', '嘩');
    res = res.replaceAll('𠵅', '嘩');
    res = res.replaceAll('蚉', '蚊');
    res = res.replaceAll('蟁', '蚊');
    res = res.replaceAll('峩', '峨');
    res = res.replaceAll('畫', '画');
    res = res.replaceAll('卧', '臥');
    res = res.replaceAll('䖸', '蛾');
    res = res.replaceAll('會', '会');
    res = res.replaceAll('觧', '解');
    res = res.replaceAll('囘', '回');
    res = res.replaceAll('壞', '壊');
    res = res.replaceAll('𢌞', '廻');
    res = res.replaceAll('廽', '廻');
    res = res.replaceAll('恠', '怪');
    res = res.replaceAll('悔', '悔');
    res = res.replaceAll('懷', '懐');
    res = res.replaceAll('海', '海');
    res = res.replaceAll('畍', '界');
    res = res.replaceAll('繪', '絵');
    res = res.replaceAll('蠏', '蟹');
    res = res.replaceAll('蛽', '貝');
    res = res.replaceAll('崕', '崖');
    res = res.replaceAll('慨', '慨');
    res = res.replaceAll('槩', '概');
    res = res.replaceAll('槪', '概');
    res = res.replaceAll('礙', '碍');
    res = res.replaceAll('盖', '蓋');
    res = res.replaceAll('葢', '蓋');
    res = res.replaceAll('䵷', '蛙');
    res = res.replaceAll('鼃', '蛙');
    res = res.replaceAll('柹', '柿');
    res = res.replaceAll('𣏕', '柿');
    res = res.replaceAll('蠣', '蛎');
    res = res.replaceAll('鉤', '鈎');
    res = res.replaceAll('擴', '拡');
    res = res.replaceAll('攪', '撹');
    res = res.replaceAll('殼', '殻');
    res = res.replaceAll('壳', '殻');
    res = res.replaceAll('碻', '確');
    res = res.replaceAll('覺', '覚');
    res = res.replaceAll('覐', '覚');
    res = res.replaceAll('爀', '赫');
    res = res.replaceAll('學', '学');
    res = res.replaceAll('斈', '学');
    res = res.replaceAll('斅', '学');
    res = res.replaceAll('嶽', '岳');
    res = res.replaceAll('樂', '楽');
    res = res.replaceAll('喝', '喝');
    res = res.replaceAll('渴', '渇');
    res = res.replaceAll('褐', '褐');
    res = res.replaceAll('鎋', '轄');
    res = res.replaceAll('兠', '兜');
    res = res.replaceAll('竈', '竃');
    res = res.replaceAll('𥧄', '竃');
    res = res.replaceAll('灶', '竃');
    res = res.replaceAll('䆴', '竃');
    res = res.replaceAll('釡', '釜');
    res = res.replaceAll('嚙', '噛');
    res = res.replaceAll('蘐', '萱');
    res = res.replaceAll('蕿', '萱');
    res = res.replaceAll('藼', '萱');
    res = res.replaceAll('鬻', '粥');
    res = res.replaceAll('刋', '刊');
    res = res.replaceAll('勸', '勧');
    res = res.replaceAll('卷', '巻');
    res = res.replaceAll('奸', '姦');
    res = res.replaceAll('姧', '姦');
    res = res.replaceAll('寬', '寛');
    res = res.replaceAll('榦', '幹');
    res = res.replaceAll('欵', '款');
    res = res.replaceAll('歡', '歓');
    res = res.replaceAll('漢', '漢');
    res = res.replaceAll('礀', '澗');
    res = res.replaceAll('灌', '潅');
    res = res.replaceAll('罐', '缶');
    res = res.replaceAll('缻', '缶');
    res = res.replaceAll('觀', '観');
    res = res.replaceAll('鑒', '鑑');
    res = res.replaceAll('鍳', '鑑');
    res = res.replaceAll('關', '関');
    res = res.replaceAll('陷', '陥');
    res = res.replaceAll('㟁', '岸');
    res = res.replaceAll('𡶜', '岸');
    res = res.replaceAll('巖', '巌');
    res = res.replaceAll('巗', '巌');
    res = res.replaceAll('鴈', '雁');
    res = res.replaceAll('鳫', '雁');
    res = res.replaceAll('顏', '顔');
    res = res.replaceAll('㐂', '喜');
    res = res.replaceAll('歖', '喜');
    res = res.replaceAll('噐', '器');
    res = res.replaceAll('器', '器');
    res = res.replaceAll('竒', '奇');
    res = res.replaceAll('既', '既');
    res = res.replaceAll('餼', '既');
    res = res.replaceAll('旣', '既');
    res = res.replaceAll('朞', '期');
    res = res.replaceAll('棊', '棋');
    res = res.replaceAll('弃', '棄');
    res = res.replaceAll('歸', '帰');
    res = res.replaceAll('皈', '帰');
    res = res.replaceAll('氣', '気');
    res = res.replaceAll('炁', '気');
    res = res.replaceAll('祈', '祈');
    res = res.replaceAll('䂓', '規');
    res = res.replaceAll('𧪄', '記');
    res = res.replaceAll('䡄', '軌');
    res = res.replaceAll('龜', '亀');
    res = res.replaceAll('僞', '偽');
    res = res.replaceAll('冝', '宜');
    res = res.replaceAll('宐', '宜');
    res = res.replaceAll('戲', '戯');
    res = res.replaceAll('犧', '犠');
    res = res.replaceAll('匊', '掬');
    res = res.replaceAll('毱', '鞠');
    res = res.replaceAll('卻', '却');
    res = res.replaceAll('屰', '逆');
    res = res.replaceAll('坵', '丘');
    res = res.replaceAll('镹', '久');
    res = res.replaceAll('糺', '糾');
    res = res.replaceAll('舊', '旧');
    res = res.replaceAll('𦾔', '旧');
    res = res.replaceAll('據', '拠');
    res = res.replaceAll('擧', '挙');
    res = res.replaceAll('舉', '挙');
    res = res.replaceAll('虗', '虚');
    res = res.replaceAll('虛', '虚');
    res = res.replaceAll('譃', '虚');
    res = res.replaceAll('亰', '京');
    res = res.replaceAll('俠', '侠');
    res = res.replaceAll('竸', '競');
    res = res.replaceAll('峽', '峡');
    res = res.replaceAll('挾', '挟');
    res = res.replaceAll('𣘺', '橋');
    res = res.replaceAll('槗', '橋');
    res = res.replaceAll('况', '況');
    res = res.replaceAll('狹', '狭');
    res = res.replaceAll('鄕', '郷');
    res = res.replaceAll('響', '響');
    res = res.replaceAll('响', '響');
    res = res.replaceAll('堯', '尭');
    res = res.replaceAll('曉', '暁');
    res = res.replaceAll('勤', '勤');
    res = res.replaceAll('珡', '琴');
    res = res.replaceAll('琹', '琴');
    res = res.replaceAll('荕', '筋');
    res = res.replaceAll('觔', '筋');
    res = res.replaceAll('竻', '筋');
    res = res.replaceAll('謹', '謹');
    res = res.replaceAll('訡', '吟');
    res = res.replaceAll('俱', '倶');
    res = res.replaceAll('區', '区');
    res = res.replaceAll('㺃', '狗');
    res = res.replaceAll('榘', '矩');
    res = res.replaceAll('軀', '躯');
    res = res.replaceAll('驅', '駆');
    res = res.replaceAll('敺', '駆');
    res = res.replaceAll('鞾', '靴');
    res = res.replaceAll('漥', '窪');
    res = res.replaceAll('桒', '桑');
    res = res.replaceAll('枽', '桑');
    res = res.replaceAll('鍫', '鍬');
    res = res.replaceAll('勳', '勲');
    res = res.replaceAll('勛', '勲');
    res = res.replaceAll('薰', '薫');
    res = res.replaceAll('羣', '群');
    res = res.replaceAll('徑', '径');
    res = res.replaceAll('逕', '径');
    res = res.replaceAll('惠', '恵');
    res = res.replaceAll('僡', '恵');
    res = res.replaceAll('憇', '憩');
    res = res.replaceAll('揭', '掲');
    res = res.replaceAll('搩', '掲');
    res = res.replaceAll('攜', '携');
    res = res.replaceAll('擕', '携');
    res = res.replaceAll('溪', '渓');
    res = res.replaceAll('谿', '渓');
    res = res.replaceAll('磎', '渓');
    res = res.replaceAll('𧮾', '渓');
    res = res.replaceAll('經', '経');
    res = res.replaceAll('巠', '経');
    res = res.replaceAll('繼', '継');
    res = res.replaceAll('繫', '繋');
    res = res.replaceAll('莖', '茎');
    res = res.replaceAll('螢', '蛍');
    res = res.replaceAll('輕', '軽');
    res = res.replaceAll('頸', '頚');
    res = res.replaceAll('鷄', '鶏');
    res = res.replaceAll('雞', '鶏');
    res = res.replaceAll('𨿸', '鶏');
    res = res.replaceAll('藝', '芸');
    res = res.replaceAll('蓺', '芸');
    res = res.replaceAll('秇', '芸');
    res = res.replaceAll('擊', '撃');
    res = res.replaceAll('杰', '傑');
    res = res.replaceAll('缺', '欠');
    res = res.replaceAll('𡙇', '欠');
    res = res.replaceAll('缼', '欠');
    res = res.replaceAll('决', '決');
    res = res.replaceAll('洯', '潔');
    res = res.replaceAll('儉', '倹');
    res = res.replaceAll('勌', '倦');
    res = res.replaceAll('徤', '健');
    res = res.replaceAll('劍', '剣');
    res = res.replaceAll('劔', '剣');
    res = res.replaceAll('劒', '剣');
    res = res.replaceAll('剱', '剣');
    res = res.replaceAll('釼', '剣');
    res = res.replaceAll('𠝏', '剣');
    res = res.replaceAll('圈', '圏');
    res = res.replaceAll('檢', '検');
    res = res.replaceAll('權', '権');
    res = res.replaceAll('獻', '献');
    res = res.replaceAll('硏', '研');
    res = res.replaceAll('縣', '県');
    res = res.replaceAll('贒', '賢');
    res = res.replaceAll('臤', '賢');
    res = res.replaceAll('險', '険');
    res = res.replaceAll('顯', '顕');
    res = res.replaceAll('㬎', '顕');
    res = res.replaceAll('驗', '験');
    res = res.replaceAll('騐', '験');
    res = res.replaceAll('鹼', '鹸');
    res = res.replaceAll('鹻', '鹸');
    res = res.replaceAll('碱', '鹸');
    res = res.replaceAll('嚴', '厳');
    res = res.replaceAll('褲', '袴');
    res = res.replaceAll('絝', '袴');
    res = res.replaceAll('苽', '菰');
    res = res.replaceAll('乕', '虎');
    res = res.replaceAll('虝', '虎');
    res = res.replaceAll('皷', '鼓');
    res = res.replaceAll('忢', '悟');
    res = res.replaceAll('矦', '侯');
    res = res.replaceAll('炗', '光');
    res = res.replaceAll('灮', '光');
    res = res.replaceAll('㓛', '功');
    res = res.replaceAll('效', '効');
    res = res.replaceAll('㫗', '厚');
    res = res.replaceAll('垕', '厚');
    res = res.replaceAll('阬', '坑');
    res = res.replaceAll('廣', '広');
    res = res.replaceAll('恆', '恒');
    res = res.replaceAll('抅', '拘');
    res = res.replaceAll('晄', '晃');
    res = res.replaceAll('熀', '晃');
    res = res.replaceAll('挍', '校');
    res = res.replaceAll('澔', '浩');
    res = res.replaceAll('稾', '稿');
    res = res.replaceAll('藳', '稿');
    res = res.replaceAll('綋', '紘');
    res = res.replaceAll('畊', '耕');
    res = res.replaceAll('厷', '肱');
    res = res.replaceAll('礦', '鉱');
    res = res.replaceAll('鑛', '鉱');
    res = res.replaceAll('磺', '鉱');
    res = res.replaceAll('夅', '降');
    res = res.replaceAll('刧', '劫');
    res = res.replaceAll('刼', '劫');
    res = res.replaceAll('號', '号');
    res = res.replaceAll('軣', '轟');
    res = res.replaceAll('輷', '轟');
    res = res.replaceAll('麯', '麹');
    res = res.replaceAll('麴', '麹');
    res = res.replaceAll('國', '国');
    res = res.replaceAll('囶', '国');
    res = res.replaceAll('圀', '国');
    res = res.replaceAll('穀', '穀');
    res = res.replaceAll('黑', '黒');
    res = res.replaceAll('嵳', '嵯');
    res = res.replaceAll('鏁', '鎖');
    res = res.replaceAll('冣', '最');
    res = res.replaceAll('㝡', '最');
    res = res.replaceAll('濟', '済');
    res = res.replaceAll('灾', '災');
    res = res.replaceAll('烖', '災');
    res = res.replaceAll('碎', '砕');
    res = res.replaceAll('齋', '斎');
    res = res.replaceAll('劑', '剤');
    res = res.replaceAll('戝', '財');
    res = res.replaceAll('冱', '冴');
    res = res.replaceAll('沍', '冴');
    res = res.replaceAll('餚', '肴');
    res = res.replaceAll('嵜', '崎');
    res = res.replaceAll('㟢', '崎');
    res = res.replaceAll('﨑', '崎');
    res = res.replaceAll('𥔎', '碕');
    res = res.replaceAll('萗', '策');
    res = res.replaceAll('櫻', '桜');
    res = res.replaceAll('册', '冊');
    res = res.replaceAll('殺', '殺');
    res = res.replaceAll('煞', '殺');
    res = res.replaceAll('蕯', '薩');
    res = res.replaceAll('雜', '雑');
    res = res.replaceAll('襍', '雑');
    res = res.replaceAll('皋', '皐');
    res = res.replaceAll('曬', '晒');
    res = res.replaceAll('參', '参');
    res = res.replaceAll('叅', '参');
    res = res.replaceAll('慘', '惨');
    res = res.replaceAll('棧', '桟');
    res = res.replaceAll('筭', '算');
    res = res.replaceAll('祘', '算');
    res = res.replaceAll('蠶', '蚕');
    res = res.replaceAll('蝅', '蚕');
    res = res.replaceAll('贊', '賛');
    res = res.replaceAll('讃', '賛');
    res = res.replaceAll('讚', '賛');
    res = res.replaceAll('湌', '餐');
    res = res.replaceAll('殘', '残');
    res = res.replaceAll('㫖', '旨');
    res = res.replaceAll('祉', '祉');
    res = res.replaceAll('絲', '糸');
    res = res.replaceAll('帋', '紙');
    res = res.replaceAll('視', '視');
    res = res.replaceAll('䳄', '雌');
    res = res.replaceAll('齒', '歯');
    res = res.replaceAll('亊', '事');
    res = res.replaceAll('㕝', '事');
    res = res.replaceAll('兒', '児');
    res = res.replaceAll('旹', '時');
    res = res.replaceAll('𦱳', '滋');
    res = res.replaceAll('尓', '爾');
    res = res.replaceAll('尒', '爾');
    res = res.replaceAll('儞', '爾');
    res = res.replaceAll('辭', '辞');
    res = res.replaceAll('辤', '辞');
    res = res.replaceAll('𠮟', '叱');
    res = res.replaceAll('濕', '湿');
    res = res.replaceAll('㯃', '漆');
    res = res.replaceAll('柒', '漆');
    res = res.replaceAll('桼', '漆');
    res = res.replaceAll('貭', '質');
    res = res.replaceAll('實', '実');
    res = res.replaceAll('筱', '篠');
    res = res.replaceAll('筿', '篠');
    res = res.replaceAll('屢', '屡');
    res = res.replaceAll('蘂', '蕊');
    res = res.replaceAll('蕋', '蕊');
    res = res.replaceAll('舍', '舎');
    res = res.replaceAll('冩', '写');
    res = res.replaceAll('寫', '写');
    res = res.replaceAll('煑', '煮');
    res = res.replaceAll('煮', '煮');
    res = res.replaceAll('社', '社');
    res = res.replaceAll('者', '者');
    res = res.replaceAll('虵', '蛇');
    res = res.replaceAll('𣏐', '杓');
    res = res.replaceAll('𣝣', '爵');
    res = res.replaceAll('釋', '釈');
    res = res.replaceAll('垨', '守');
    res = res.replaceAll('咒', '呪');
    res = res.replaceAll('壽', '寿');
    res = res.replaceAll('收', '収');
    res = res.replaceAll('綉', '繍');
    res = res.replaceAll('繡', '繍');
    res = res.replaceAll('臭', '臭');
    res = res.replaceAll('讎', '讐');
    res = res.replaceAll('亼', '集');
    res = res.replaceAll('𠍱', '集');
    res = res.replaceAll('從', '従');
    res = res.replaceAll('从', '従');
    res = res.replaceAll('澁', '渋');
    res = res.replaceAll('澀', '渋');
    res = res.replaceAll('獸', '獣');
    res = res.replaceAll('縱', '縦');
    res = res.replaceAll('祝', '祝');
    res = res.replaceAll('肅', '粛');
    res = res.replaceAll('凖', '準');
    res = res.replaceAll('處', '処');
    res = res.replaceAll('暑', '暑');
    res = res.replaceAll('渚', '渚');
    res = res.replaceAll('緖', '緒');
    res = res.replaceAll('署', '署');
    res = res.replaceAll('諸', '諸');
    res = res.replaceAll('敍', '叙');
    res = res.replaceAll('敘', '叙');
    res = res.replaceAll('甞', '嘗');
    res = res.replaceAll('奬', '奨');
    res = res.replaceAll('獎', '奨');
    res = res.replaceAll('將', '将');
    res = res.replaceAll('厰', '廠');
    res = res.replaceAll('曻', '昇');
    res = res.replaceAll('𣇵', '晶');
    res = res.replaceAll('枩', '松');
    res = res.replaceAll('柗', '松');
    res = res.replaceAll('梥', '松');
    res = res.replaceAll('㮤', '松');
    res = res.replaceAll('涉', '渉');
    res = res.replaceAll('燒', '焼');
    res = res.replaceAll('祥', '祥');
    res = res.replaceAll('稱', '称');
    res = res.replaceAll('穪', '称');
    res = res.replaceAll('偁', '称');
    res = res.replaceAll('蔣', '蒋');
    res = res.replaceAll('證', '証');
    res = res.replaceAll('醬', '醤');
    res = res.replaceAll('𠀋', '丈');
    res = res.replaceAll('乘', '乗');
    res = res.replaceAll('椉', '乗');
    res = res.replaceAll('剩', '剰');
    res = res.replaceAll('塲', '場');
    res = res.replaceAll('壤', '壌');
    res = res.replaceAll('孃', '嬢');
    res = res.replaceAll('條', '条');
    res = res.replaceAll('淨', '浄');
    res = res.replaceAll('狀', '状');
    res = res.replaceAll('疊', '畳');
    res = res.replaceAll('疉', '畳');
    res = res.replaceAll('疂', '畳');
    res = res.replaceAll('叠', '畳');
    res = res.replaceAll('穰', '穣');
    res = res.replaceAll('讓', '譲');
    res = res.replaceAll('釀', '醸');
    res = res.replaceAll('囑', '嘱');
    res = res.replaceAll('餝', '飾');
    res = res.replaceAll('㯰', '植');
    res = res.replaceAll('𦀗', '織');
    res = res.replaceAll('觸', '触');
    res = res.replaceAll('觕', '触');
    res = res.replaceAll('脣', '唇');
    res = res.replaceAll('寢', '寝');
    res = res.replaceAll('愼', '慎');
    res = res.replaceAll('晉', '晋');
    res = res.replaceAll('㬜', '晋');
    res = res.replaceAll('寖', '浸');
    res = res.replaceAll('濅', '浸');
    res = res.replaceAll('𤺋', '疹');
    res = res.replaceAll('眞', '真');
    res = res.replaceAll('神', '神');
    res = res.replaceAll('𨐌', '辛');
    res = res.replaceAll('亻', '人');
    res = res.replaceAll('𠆢', '人');
    res = res.replaceAll('刄', '刃');
    res = res.replaceAll('盡', '尽');
    res = res.replaceAll('靫', '靭');
    res = res.replaceAll('靱', '靭');
    res = res.replaceAll('韌', '靭');
    res = res.replaceAll('醋', '酢');
    res = res.replaceAll('圖', '図');
    res = res.replaceAll('啚', '図');
    res = res.replaceAll('廚', '厨');
    res = res.replaceAll('橱', '厨');
    res = res.replaceAll('埀', '垂');
    res = res.replaceAll('粹', '粋');
    res = res.replaceAll('翆', '翠');
    res = res.replaceAll('醉', '酔');
    res = res.replaceAll('隨', '随');
    res = res.replaceAll('膸', '髄');
    res = res.replaceAll('髓', '髄');
    res = res.replaceAll('數', '数');
    res = res.replaceAll('樞', '枢');
    res = res.replaceAll('鶵', '雛');
    res = res.replaceAll('杦', '杉');
    res = res.replaceAll('澂', '澄');
    res = res.replaceAll('丗', '世');
    res = res.replaceAll('卋', '世');
    res = res.replaceAll('瀨', '瀬');
    res = res.replaceAll('畆', '畝');
    res = res.replaceAll('㽗', '畝');
    res = res.replaceAll('𤰖', '畝');
    res = res.replaceAll('畒', '畝');
    res = res.replaceAll('畞', '畝');
    res = res.replaceAll('昰', '是');
    res = res.replaceAll('淒', '凄');
    res = res.replaceAll('㔟', '勢');
    res = res.replaceAll('皨', '星');
    res = res.replaceAll('暒', '晴');
    res = res.replaceAll('晴', '晴');
    res = res.replaceAll('聲', '声');
    res = res.replaceAll('靜', '静');
    res = res.replaceAll('齊', '斉');
    res = res.replaceAll('亝', '斉');
    res = res.replaceAll('斊', '斉');
    res = res.replaceAll('攝', '摂');
    res = res.replaceAll('竊', '窃');
    res = res.replaceAll('節', '節');
    res = res.replaceAll('蟬', '蝉');
    res = res.replaceAll('專', '専');
    res = res.replaceAll('巛', '川');
    res = res.replaceAll('戰', '戦');
    res = res.replaceAll('洤', '泉');
    res = res.replaceAll('淺', '浅');
    res = res.replaceAll('潛', '潜');
    res = res.replaceAll('濳', '潜');
    res = res.replaceAll('綫', '線');
    res = res.replaceAll('纖', '繊');
    res = res.replaceAll('纎', '繊');
    res = res.replaceAll('舩', '船');
    res = res.replaceAll('賤', '賎');
    res = res.replaceAll('踐', '践');
    res = res.replaceAll('迁', '遷');
    res = res.replaceAll('錢', '銭');
    res = res.replaceAll('偂', '前');
    res = res.replaceAll('歬', '前');
    res = res.replaceAll('譱', '善');
    res = res.replaceAll('禪', '禅');
    res = res.replaceAll('饍', '膳');
    res = res.replaceAll('𡏄', '塑');
    res = res.replaceAll('䟽', '疏');
    res = res.replaceAll('踈', '疎');
    res = res.replaceAll('祖', '祖');
    res = res.replaceAll('蘓', '蘇');
    res = res.replaceAll('穌', '蘇');
    res = res.replaceAll('溯', '遡');
    res = res.replaceAll('㴑', '遡');
    res = res.replaceAll('鼡', '鼠');
    res = res.replaceAll('僧', '僧');
    res = res.replaceAll('雙', '双');
    res = res.replaceAll('壯', '壮');
    res = res.replaceAll('層', '層');
    res = res.replaceAll('帀', '匝');
    res = res.replaceAll('迊', '匝');
    res = res.replaceAll('搜', '捜');
    res = res.replaceAll('插', '挿');
    res = res.replaceAll('揷', '挿');
    res = res.replaceAll('搔', '掻');
    res = res.replaceAll('曺', '曹');
    res = res.replaceAll('巢', '巣');
    res = res.replaceAll('爭', '争');
    res = res.replaceAll('瘦', '痩');
    res = res.replaceAll('膄', '痩');
    res = res.replaceAll('𥄢', '相');
    res = res.replaceAll('窗', '窓');
    res = res.replaceAll('牕', '窓');
    res = res.replaceAll('窻', '窓');
    res = res.replaceAll('總', '総');
    res = res.replaceAll('摠', '総');
    res = res.replaceAll('揔', '総');
    res = res.replaceAll('緫', '総');
    res = res.replaceAll('聰', '聡');
    res = res.replaceAll('聦', '聡');
    res = res.replaceAll('莊', '荘');
    res = res.replaceAll('㽵', '荘');
    res = res.replaceAll('裝', '装');
    res = res.replaceAll('赱', '走');
    res = res.replaceAll('騷', '騒');
    res = res.replaceAll('增', '増');
    res = res.replaceAll('憎', '憎');
    res = res.replaceAll('臟', '臓');
    res = res.replaceAll('藏', '蔵');
    res = res.replaceAll('匨', '蔵');
    res = res.replaceAll('贈', '贈');
    res = res.replaceAll('卽', '即');
    res = res.replaceAll('皍', '即');
    res = res.replaceAll('𧾷', '足');
    res = res.replaceAll('屬', '属');
    res = res.replaceAll('續', '続');
    res = res.replaceAll('賡', '続');
    res = res.replaceAll('卆', '卒');
    res = res.replaceAll('邨', '村');
    res = res.replaceAll('夛', '多');
    res = res.replaceAll('冭', '太');
    res = res.replaceAll('墮', '堕');
    res = res.replaceAll('橢', '楕');
    res = res.replaceAll('驒', '騨');
    res = res.replaceAll('躰', '体');
    res = res.replaceAll('軆', '体');
    res = res.replaceAll('體', '体');
    res = res.replaceAll('𠂤', '堆');
    res = res.replaceAll('對', '対');
    res = res.replaceAll('帶', '帯');
    res = res.replaceAll('𣳾', '泰');
    res = res.replaceAll('㤗', '泰');
    res = res.replaceAll('滯', '滞');
    res = res.replaceAll('帒', '袋');
    res = res.replaceAll('臺', '台');
    res = res.replaceAll('䑓', '台');
    res = res.replaceAll('坮', '台');
    res = res.replaceAll('桌', '卓');
    res = res.replaceAll('擇', '択');
    res = res.replaceAll('澤', '沢');
    res = res.replaceAll('琢', '琢');
    res = res.replaceAll('鈬', '鐸');
    res = res.replaceAll('逹', '達');
    res = res.replaceAll('达', '達');
    res = res.replaceAll('豎', '竪');
    res = res.replaceAll('貍', '狸');
    res = res.replaceAll('墫', '樽');
    res = res.replaceAll('罇', '樽');
    res = res.replaceAll('單', '単');
    res = res.replaceAll('嘆', '嘆');
    res = res.replaceAll('擔', '担');
    res = res.replaceAll('耑', '端');
    res = res.replaceAll('簞', '箪');
    res = res.replaceAll('膽', '胆');
    res = res.replaceAll('團', '団');
    res = res.replaceAll('彈', '弾');
    res = res.replaceAll('斷', '断');
    res = res.replaceAll('耻', '恥');
    res = res.replaceAll('癡', '痴');
    res = res.replaceAll('穉', '稚');
    res = res.replaceAll('遲', '遅');
    res = res.replaceAll('稸', '蓄');
    res = res.replaceAll('𢭆', '抽');
    res = res.replaceAll('晝', '昼');
    res = res.replaceAll('蟲', '虫');
    res = res.replaceAll('䖝', '虫');
    res = res.replaceAll('鑄', '鋳');
    res = res.replaceAll('潴', '瀦');
    res = res.replaceAll('豬', '猪');
    res = res.replaceAll('猪', '猪');
    res = res.replaceAll('䐗', '猪');
    res = res.replaceAll('著', '著');
    res = res.replaceAll('廳', '庁');
    res = res.replaceAll('廰', '庁');
    res = res.replaceAll('徵', '徴');
    res = res.replaceAll('懲', '懲');
    res = res.replaceAll('甼', '町');
    res = res.replaceAll('聽', '聴');
    res = res.replaceAll('膓', '腸');
    res = res.replaceAll('镸', '長');
    res = res.replaceAll('敕', '勅');
    res = res.replaceAll('沉', '沈');
    res = res.replaceAll('珎', '珍');
    res = res.replaceAll('鎭', '鎮');
    res = res.replaceAll('塚', '塚');
    res = res.replaceAll('冢', '塚');
    res = res.replaceAll('摑', '掴');
    res = res.replaceAll('壺', '壷');
    res = res.replaceAll('寉', '鶴');
    res = res.replaceAll('靍', '鶴');
    res = res.replaceAll('靎', '鶴');
    res = res.replaceAll('靏', '鶴');
    res = res.replaceAll('隺', '鶴');
    res = res.replaceAll('埞', '堤');
    res = res.replaceAll('矴', '碇');
    res = res.replaceAll('椗', '碇');
    res = res.replaceAll('禎', '禎');
    res = res.replaceAll('遞', '逓');
    res = res.replaceAll('𣇄', '鼎');
    res = res.replaceAll('鼑', '鼎');
    res = res.replaceAll('埿', '泥');
    res = res.replaceAll('喆', '哲');
    res = res.replaceAll('嚞', '哲');
    res = res.replaceAll('啠', '哲');
    res = res.replaceAll('悊', '哲');
    res = res.replaceAll('銕', '鉄');
    res = res.replaceAll('鐵', '鉄');
    res = res.replaceAll('鐡', '鉄');
    res = res.replaceAll('塡', '填');
    res = res.replaceAll('沗', '添');
    res = res.replaceAll('𣷹', '添');
    res = res.replaceAll('纒', '纏');
    res = res.replaceAll('轉', '転');
    res = res.replaceAll('顚', '顛');
    res = res.replaceAll('點', '点');
    res = res.replaceAll('傳', '伝');
    res = res.replaceAll('兔', '兎');
    res = res.replaceAll('莵', '兎');
    res = res.replaceAll('菟', '兎');
    res = res.replaceAll('妒', '妬');
    res = res.replaceAll('都', '都');
    res = res.replaceAll('礪', '砺');
    res = res.replaceAll('𡈽', '土');
    res = res.replaceAll('圡', '土');
    res = res.replaceAll('黨', '党');
    res = res.replaceAll('嶌', '島');
    res = res.replaceAll('隝', '島');
    res = res.replaceAll('㠀', '島');
    res = res.replaceAll('嶹', '島');
    res = res.replaceAll('嶋', '島');
    res = res.replaceAll('檮', '梼');
    res = res.replaceAll('盜', '盗');
    res = res.replaceAll('濤', '涛');
    res = res.replaceAll('當', '当');
    res = res.replaceAll('禱', '祷');
    res = res.replaceAll('筩', '筒');
    res = res.replaceAll('𥹥', '糖');
    res = res.replaceAll('迯', '逃');
    res = res.replaceAll('鬪', '闘');
    res = res.replaceAll('鬭', '闘');
    res = res.replaceAll('鬦', '闘');
    res = res.replaceAll('仂', '働');
    res = res.replaceAll('衟', '道');
    res = res.replaceAll('㝵', '得');
    res = res.replaceAll('悳', '徳');
    res = res.replaceAll('德', '徳');
    res = res.replaceAll('𢛳', '徳');
    res = res.replaceAll('瀆', '涜');
    res = res.replaceAll('䔍', '篤');
    res = res.replaceAll('獨', '独');
    res = res.replaceAll('讀', '読');
    res = res.replaceAll('杤', '栃');
    res = res.replaceAll('𣜜', '栃');
    res = res.replaceAll('突', '突');
    res = res.replaceAll('屆', '届');
    res = res.replaceAll('㹠', '豚');
    res = res.replaceAll('吞', '呑');
    res = res.replaceAll('柰', '奈');
    res = res.replaceAll('繩', '縄');
    res = res.replaceAll('輭', '軟');
    res = res.replaceAll('難', '難');
    res = res.replaceAll('貳', '弐');
    res = res.replaceAll('貮', '弐');
    res = res.replaceAll('邇', '迩');
    res = res.replaceAll('韭', '韮');
    res = res.replaceAll('姙', '妊');
    res = res.replaceAll('甯', '寧');
    res = res.replaceAll('寍', '寧');
    res = res.replaceAll('蔥', '葱');
    res = res.replaceAll('貓', '猫');
    res = res.replaceAll('秊', '年');
    res = res.replaceAll('黏', '粘');
    res = res.replaceAll('迺', '廼');
    res = res.replaceAll('𡌛', '埜');
    res = res.replaceAll('囊', '嚢');
    res = res.replaceAll('惱', '悩');
    res = res.replaceAll('腦', '脳');
    res = res.replaceAll('霸', '覇');
    res = res.replaceAll('廢', '廃');
    res = res.replaceAll('拜', '拝');
    res = res.replaceAll('桮', '杯');
    res = res.replaceAll('盃', '杯');
    res = res.replaceAll('梅', '梅');
    res = res.replaceAll('坆', '梅');
    res = res.replaceAll('槑', '梅');
    res = res.replaceAll('賣', '売');
    res = res.replaceAll('蠅', '蝿');
    res = res.replaceAll('矤', '矧');
    res = res.replaceAll('剝', '剥');
    res = res.replaceAll('愽', '博');
    res = res.replaceAll('廹', '迫');
    res = res.replaceAll('麥', '麦');
    res = res.replaceAll('凾', '函');
    res = res.replaceAll('枦', '櫨');
    res = res.replaceAll('𥁊', '鉢');
    res = res.replaceAll('缽', '鉢');
    res = res.replaceAll('潑', '溌');
    res = res.replaceAll('發', '発');
    res = res.replaceAll('醱', '醗');
    res = res.replaceAll('髮', '髪');
    res = res.replaceAll('罸', '罰');
    res = res.replaceAll('拔', '抜');
    res = res.replaceAll('㠶', '帆');
    res = res.replaceAll('䑺', '帆');
    res = res.replaceAll('繁', '繁');
    res = res.replaceAll('飰', '飯');
    res = res.replaceAll('晚', '晩');
    res = res.replaceAll('𣆶', '晩');
    res = res.replaceAll('蠻', '蛮');
    res = res.replaceAll('卑', '卑');
    res = res.replaceAll('碑', '碑');
    res = res.replaceAll('祕', '秘');
    res = res.replaceAll('毗', '毘');
    res = res.replaceAll('蔆', '菱');
    res = res.replaceAll('檜', '桧');
    res = res.replaceAll('冰', '氷');
    res = res.replaceAll('庿', '廟');
    res = res.replaceAll('濱', '浜');
    res = res.replaceAll('濵', '浜');
    res = res.replaceAll('賓', '賓');
    res = res.replaceAll('頻', '頻');
    res = res.replaceAll('敏', '敏');
    res = res.replaceAll('勄', '敏');
    res = res.replaceAll('甁', '瓶');
    res = res.replaceAll('缾', '瓶');
    res = res.replaceAll('旉', '敷');
    res = res.replaceAll('𨨞', '斧');
    res = res.replaceAll('肤', '膚');
    res = res.replaceAll('侮', '侮');
    res = res.replaceAll('儛', '舞');
    res = res.replaceAll('郶', '部');
    res = res.replaceAll('凮', '風');
    res = res.replaceAll('福', '福');
    res = res.replaceAll('渕', '淵');
    res = res.replaceAll('渊', '淵');
    res = res.replaceAll('囦', '淵');
    res = res.replaceAll('拂', '払');
    res = res.replaceAll('佛', '仏');
    res = res.replaceAll('燓', '焚');
    res = res.replaceAll('𥹢', '聞');
    res = res.replaceAll('倂', '併');
    res = res.replaceAll('塀', '塀');
    res = res.replaceAll('幤', '幣');
    res = res.replaceAll('棅', '柄');
    res = res.replaceAll('竝', '並');
    res = res.replaceAll('閇', '閉');
    res = res.replaceAll('篦', '箆');
    res = res.replaceAll('變', '変');
    res = res.replaceAll('邊', '辺');
    res = res.replaceAll('邉', '辺');
    res = res.replaceAll('徧', '遍');
    res = res.replaceAll('勉', '勉');
    res = res.replaceAll('辨', '弁');
    res = res.replaceAll('辧', '弁');
    res = res.replaceAll('瓣', '弁');
    res = res.replaceAll('辯', '弁');
    res = res.replaceAll('舖', '舗');
    res = res.replaceAll('步', '歩');
    res = res.replaceAll('穗', '穂');
    res = res.replaceAll('寶', '宝');
    res = res.replaceAll('寳', '宝');
    res = res.replaceAll('寚', '宝');
    res = res.replaceAll('㳒', '法');
    res = res.replaceAll('灋', '法');
    res = res.replaceAll('佱', '法');
    res = res.replaceAll('礮', '砲');
    res = res.replaceAll('炮', '砲');
    res = res.replaceAll('萠', '萌');
    res = res.replaceAll('襃', '褒');
    res = res.replaceAll('豐', '豊');
    res = res.replaceAll('冃', '帽');
    res = res.replaceAll('冐', '冒');
    res = res.replaceAll('皃', '貌');
    res = res.replaceAll('㒵', '貌');
    res = res.replaceAll('頰', '頬');
    res = res.replaceAll('㒒', '僕');
    res = res.replaceAll('墨', '墨');
    res = res.replaceAll('沒', '没');
    res = res.replaceAll('夲', '本');
    res = res.replaceAll('飜', '翻');
    res = res.replaceAll('凢', '凡');
    res = res.replaceAll('蔴', '麻');
    res = res.replaceAll('每', '毎');
    res = res.replaceAll('槇', '槙');
    res = res.replaceAll('枡', '桝');
    res = res.replaceAll('枒', '桝');
    res = res.replaceAll('儘', '侭');
    res = res.replaceAll('萬', '万');
    res = res.replaceAll('滿', '満');
    res = res.replaceAll('鬽', '魅');
    res = res.replaceAll('簑', '蓑');
    res = res.replaceAll('簔', '蓑');
    res = res.replaceAll('脉', '脈');
    res = res.replaceAll('玅', '妙');
    res = res.replaceAll('梦', '夢');
    res = res.replaceAll('夣', '夢');
    res = res.replaceAll('壻', '婿');
    res = res.replaceAll('聟', '婿');
    res = res.replaceAll('朙', '明');
    res = res.replaceAll('免', '免');
    res = res.replaceAll('緜', '綿');
    res = res.replaceAll('麪', '麺');
    res = res.replaceAll('麵', '麺');
    res = res.replaceAll('摹', '摸');
    res = res.replaceAll('橅', '模');
    res = res.replaceAll('默', '黙');
    res = res.replaceAll('餠', '餅');
    res = res.replaceAll('戾', '戻');
    res = res.replaceAll('彌', '弥');
    res = res.replaceAll('藥', '薬');
    res = res.replaceAll('譯', '訳');
    res = res.replaceAll('竫', '靖');
    res = res.replaceAll('靖', '靖');
    res = res.replaceAll('栁', '柳');
    res = res.replaceAll('桺', '柳');
    res = res.replaceAll('籔', '薮');
    res = res.replaceAll('藪', '薮');
    res = res.replaceAll('䉤', '薮');
    res = res.replaceAll('𨯯', '鑓');
    res = res.replaceAll('瘉', '癒');
    res = res.replaceAll('勈', '勇');
    res = res.replaceAll('恿', '勇');
    res = res.replaceAll('祐', '祐');
    res = res.replaceAll('䧺', '雄');
    res = res.replaceAll('豫', '予');
    res = res.replaceAll('餘', '余');
    res = res.replaceAll('與', '与');
    res = res.replaceAll('譽', '誉');
    res = res.replaceAll('搖', '揺');
    res = res.replaceAll('樣', '様');
    res = res.replaceAll('窰', '窯');
    res = res.replaceAll('窑', '窯');
    res = res.replaceAll('𦍌', '羊');
    res = res.replaceAll('燿', '耀');
    res = res.replaceAll('謠', '謡');
    res = res.replaceAll('踴', '踊');
    res = res.replaceAll('遙', '遥');
    res = res.replaceAll('阳', '陽');
    res = res.replaceAll('昜', '陽');
    res = res.replaceAll('阦', '陽');
    res = res.replaceAll('养', '養');
    res = res.replaceAll('𦐂', '翼');
    res = res.replaceAll('躶', '裸');
    res = res.replaceAll('來', '来');
    res = res.replaceAll('徠', '来');
    res = res.replaceAll('萊', '莱');
    res = res.replaceAll('賴', '頼');
    res = res.replaceAll('靁', '雷');
    res = res.replaceAll('亂', '乱');
    res = res.replaceAll('欄', '欄');
    res = res.replaceAll('覽', '覧');
    res = res.replaceAll('棃', '梨');
    res = res.replaceAll('瓈', '璃');
    res = res.replaceAll('畧', '略');
    res = res.replaceAll('澑', '溜');
    res = res.replaceAll('畄', '留');
    res = res.replaceAll('畱', '留');
    res = res.replaceAll('隆', '隆');
    res = res.replaceAll('虜', '虜');
    res = res.replaceAll('兩', '両');
    res = res.replaceAll('两', '両');
    res = res.replaceAll('樑', '梁');
    res = res.replaceAll('凉', '涼');
    res = res.replaceAll('獵', '猟');
    res = res.replaceAll('暸', '瞭');
    res = res.replaceAll('粮', '糧');
    res = res.replaceAll('綠', '緑');
    res = res.replaceAll('鄰', '隣');
    res = res.replaceAll('厸', '隣');
    res = res.replaceAll('璢', '瑠');
    res = res.replaceAll('壘', '塁');
    res = res.replaceAll('泪', '涙');
    res = res.replaceAll('淚', '涙');
    res = res.replaceAll('纍', '累');
    res = res.replaceAll('類', '類');
    res = res.replaceAll('勵', '励');
    res = res.replaceAll('禮', '礼');
    res = res.replaceAll('隸', '隷');
    res = res.replaceAll('靈', '霊');
    res = res.replaceAll('灵', '霊');
    res = res.replaceAll('㚑', '霊');
    res = res.replaceAll('䨩', '霊');
    res = res.replaceAll('霛', '霊');
    res = res.replaceAll('齡', '齢');
    res = res.replaceAll('曆', '暦');
    res = res.replaceAll('厤', '暦');
    res = res.replaceAll('歷', '歴');
    res = res.replaceAll('戀', '恋');
    res = res.replaceAll('練', '練');
    res = res.replaceAll('聨', '聯');
    res = res.replaceAll('鍊', '錬');
    res = res.replaceAll('爐', '炉');
    res = res.replaceAll('勞', '労');
    res = res.replaceAll('憥', '労');
    res = res.replaceAll('廊', '廊');
    res = res.replaceAll('挊', '弄');
    res = res.replaceAll('挵', '弄');
    res = res.replaceAll('朖', '朗');
    res = res.replaceAll('朗', '朗');
    res = res.replaceAll('樓', '楼');
    res = res.replaceAll('窂', '牢');
    res = res.replaceAll('籠', '篭');
    res = res.replaceAll('蠟', '蝋');
    res = res.replaceAll('郞', '郎');
    res = res.replaceAll('祿', '禄');
    res = res.replaceAll('錄', '録');
    res = res.replaceAll('龢', '和');
    res = res.replaceAll('咊', '和');
    res = res.replaceAll('𦚰', '脇');
    res = res.replaceAll('䏮', '脇');
    res = res.replaceAll('鱷', '鰐');
    res = res.replaceAll('灣', '湾');
    res = res.replaceAll('盌', '碗');
    res = res.replaceAll('𢪸', '腕');
    res = res.replaceAll('焏', '亟');
    res = res.replaceAll('仭', '仞');
    res = res.replaceAll('爼', '俎');
    res = res.replaceAll('伜', '倅');
    res = res.replaceAll('𠈓', '倆');
    res = res.replaceAll('俲', '傚');
    res = res.replaceAll('慠', '傲');
    res = res.replaceAll('僲', '僊');
    res = res.replaceAll('僣', '僭');
    res = res.replaceAll('㑪', '儕');
    res = res.replaceAll('俦', '儔');
    res = res.replaceAll('𠑊', '儼');
    res = res.replaceAll('兊', '兌');
    res = res.replaceAll('冋', '冂');
    res = res.replaceAll('寃', '冤');
    res = res.replaceAll('寇', '冦');
    res = res.replaceAll('羃', '冪');
    res = res.replaceAll('洌', '冽');
    res = res.replaceAll('涸', '凅');
    res = res.replaceAll('凜', '凛');
    res = res.replaceAll('澟', '凛');
    res = res.replaceAll('𠘨', '几');
    res = res.replaceAll('凴', '凭');
    res = res.replaceAll('尅', '剋');
    res = res.replaceAll('勊', '剋');
    res = res.replaceAll('箚', '剳');
    res = res.replaceAll('劄', '剳');
    res = res.replaceAll('劤', '勁');
    res = res.replaceAll('勖', '勗');
    res = res.replaceAll('匇', '匆');
    res = res.replaceAll('滙', '匯');
    res = res.replaceAll('奩', '匳');
    res = res.replaceAll('匲', '匳');
    res = res.replaceAll('巵', '卮');
    res = res.replaceAll('庬', '厖');
    res = res.replaceAll('廁', '厠');
    res = res.replaceAll('廈', '厦');
    res = res.replaceAll('廝', '厮');
    res = res.replaceAll('爕', '燮');
    res = res.replaceAll('呍', '吽');
    res = res.replaceAll('吒', '咤');
    res = res.replaceAll('咜', '咤');
    res = res.replaceAll('噉', '啖');
    res = res.replaceAll('咯', '喀');
    res = res.replaceAll('齅', '嗅');
    res = res.replaceAll('呕', '嘔');
    res = res.replaceAll('嘨', '嘯');
    res = res.replaceAll('譟', '噪');
    res = res.replaceAll('嚏', '嚔');
    res = res.replaceAll('齧', '囓');
    res = res.replaceAll('𪘂', '囓');
    res = res.replaceAll('阯', '址');
    res = res.replaceAll('坯', '坏');
    res = res.replaceAll('确', '埆');
    res = res.replaceAll('礐', '埆');
    res = res.replaceAll('埓', '埒');
    res = res.replaceAll('𡉻', '埣');
    res = res.replaceAll('壍', '塹');
    res = res.replaceAll('牆', '墻');
    res = res.replaceAll('𡋤', '壗');
    res = res.replaceAll('罎', '壜');
    res = res.replaceAll('壠', '壟');
    res = res.replaceAll('弉', '奘');
    res = res.replaceAll('𡝂', '妝');
    res = res.replaceAll('侫', '佞');
    res = res.replaceAll('姸', '妍');
    res = res.replaceAll('姮', '嫦');
    res = res.replaceAll('嫰', '嫩');
    res = res.replaceAll('嫻', '嫺');
    res = res.replaceAll('嫐', '嬲');
    res = res.replaceAll('尣', '尢');
    res = res.replaceAll('𥧔', '屁');
    res = res.replaceAll('屛', '屏');
    res = res.replaceAll('崫', '崛');
    res = res.replaceAll('崐', '崑');
    res = res.replaceAll('崘', '崙');
    res = res.replaceAll('篏', '嵌');
    res = res.replaceAll('嵓', '嵒');
    res = res.replaceAll('㟴', '嵬');
    res = res.replaceAll('嶤', '嶢');
    res = res.replaceAll('𡸳', '嶢');
    res = res.replaceAll('𡸴', '嶮');
    res = res.replaceAll('菷', '帚');
    res = res.replaceAll('伖', '帑');
    res = res.replaceAll('帮', '幇');
    res = res.replaceAll('幫', '幇');
    res = res.replaceAll('幷', '并');
    res = res.replaceAll('么', '幺');
    res = res.replaceAll('麽', '麼');
    res = res.replaceAll('鄽', '廛');
    res = res.replaceAll('壥', '廛');
    res = res.replaceAll('迪', '廸');
    res = res.replaceAll('彜', '彝');
    res = res.replaceAll('彛', '彝');
    res = res.replaceAll('弯', '彎');
    res = res.replaceAll('髴', '彿');
    res = res.replaceAll('傜', '徭');
    res = res.replaceAll('忩', '怱');
    res = res.replaceAll('悤', '怱');
    res = res.replaceAll('愙', '恪');
    res = res.replaceAll('䘏', '恤');
    res = res.replaceAll('卹', '恤');
    res = res.replaceAll('忰', '悴');
    res = res.replaceAll('諐', '愆');
    res = res.replaceAll('媿', '愧');
    res = res.replaceAll('忼', '慷');
    res = res.replaceAll('慚', '慙');
    res = res.replaceAll('憘', '憙');
    res = res.replaceAll('憗', '憖');
    res = res.replaceAll('惮', '憚');
    res = res.replaceAll('愞', '懦');
    res = res.replaceAll('懧', '懦');
    res = res.replaceAll('𢡛', '懣');
    res = res.replaceAll('懴', '懺');
    res = res.replaceAll('戞', '戛');
    res = res.replaceAll('扨', '扠');
    res = res.replaceAll('𢰤', '掎');
    res = res.replaceAll('𢭐', '撈');
    res = res.replaceAll('抬', '擡');
    res = res.replaceAll('𢭏', '擣');
    res = res.replaceAll('擥', '攬');
    res = res.replaceAll('攢', '攅');
    res = res.replaceAll('爴', '攫');
    res = res.replaceAll('攵', '攴');
    res = res.replaceAll('搞', '敲');
    res = res.replaceAll('酙', '斟');
    res = res.replaceAll('㐬', '旒');
    res = res.replaceAll('旙', '旛');
    res = res.replaceAll('暱', '昵');
    res = res.replaceAll('皓', '晧');
    res = res.replaceAll('皜', '晧');
    res = res.replaceAll('晣', '晢');
    res = res.replaceAll('晳', '晰');
    res = res.replaceAll('煊', '暄');
    res = res.replaceAll('昿', '曠');
    res = res.replaceAll('㬢', '曦');
    res = res.replaceAll('䒳', '朶');
    res = res.replaceAll('桿', '杆');
    res = res.replaceAll('𣑥', '栲');
    res = res.replaceAll('檔', '档');
    res = res.replaceAll('檳', '梹');
    res = res.replaceAll('皁', '梍');
    res = res.replaceAll('槨', '椁');
    res = res.replaceAll('槶', '椢');
    res = res.replaceAll('棬', '椦');
    res = res.replaceAll('椶', '棕');
    res = res.replaceAll('檝', '楫');
    res = res.replaceAll('槀', '槁');
    res = res.replaceAll('柈', '槃');
    res = res.replaceAll('櫳', '槞');
    res = res.replaceAll('櫁', '樒');
    res = res.replaceAll('𣓤', '橈');
    res = res.replaceAll('蘗', '檗');
    res = res.replaceAll('檪', '櫟');
    res = res.replaceAll('﨔', '欅');
    res = res.replaceAll('櫱', '蘖');
    res = res.replaceAll('欞', '櫺');
    res = res.replaceAll('栾', '欒');
    res = res.replaceAll('𣠤', '欟');
    res = res.replaceAll('歺', '歹');
    res = res.replaceAll('殁', '歿');
    res = res.replaceAll('歾', '歿');
    res = res.replaceAll('殱', '殲');
    res = res.replaceAll('毮', '毟');
    res = res.replaceAll('氊', '氈');
    res = res.replaceAll('毡', '氈');
    res = res.replaceAll('汴', '汳');
    res = res.replaceAll('淛', '浙');
    res = res.replaceAll('𣵀', '涅');
    res = res.replaceAll('㳃', '淬');
    res = res.replaceAll('㴞', '滔');
    res = res.replaceAll('霶', '滂');
    res = res.replaceAll('涁', '滲');
    res = res.replaceAll('渗', '滲');
    res = res.replaceAll('澘', '潸');
    res = res.replaceAll('泻', '瀉');
    res = res.replaceAll('沪', '濾');
    res = res.replaceAll('烱', '炯');
    res = res.replaceAll('熢', '烽');
    res = res.replaceAll('熈', '煕');
    res = res.replaceAll('凞', '煕');
    res = res.replaceAll('凞', '煕');
    res = res.replaceAll('焈', '煕');
    res = res.replaceAll('巸', '煕');
    res = res.replaceAll('熙', '煕');
    res = res.replaceAll('㷀', '煢');
    res = res.replaceAll('焭', '煢');
    res = res.replaceAll('燻', '熏');
    res = res.replaceAll('烬', '燼');
    res = res.replaceAll('丬', '爿');
    res = res.replaceAll('箋', '牋');
    res = res.replaceAll('㮍', '牋');
    res = res.replaceAll('䇳', '牋');
    res = res.replaceAll('犁', '犂');
    res = res.replaceAll('㸿', '犢');
    res = res.replaceAll('豺', '犲');
    res = res.replaceAll('貉', '狢');
    res = res.replaceAll('倐', '倏');
    res = res.replaceAll('儵', '倏');
    res = res.replaceAll('貎', '猊');
    res = res.replaceAll('貒', '猯');
    res = res.replaceAll('貘', '獏');
    res = res.replaceAll('瑇', '玳');
    res = res.replaceAll('瑯', '琅');
    res = res.replaceAll('碯', '瑙');
    res = res.replaceAll('瑤', '瑶');
    res = res.replaceAll('琁', '瓊');
    res = res.replaceAll('珱', '瓔');
    res = res.replaceAll('瓯', '甌');
    res = res.replaceAll('畬', '畭');
    res = res.replaceAll('畲', '畭');
    res = res.replaceAll('壃', '疆');
    res = res.replaceAll('畺', '疆');
    res = res.replaceAll('疅', '疆');
    res = res.replaceAll('畴', '疇');
    res = res.replaceAll('肬', '疣');
    res = res.replaceAll('瘘', '瘻');
    res = res.replaceAll('癕', '癰');
    res = res.replaceAll('臃', '癰');
    res = res.replaceAll('晈', '皎');
    res = res.replaceAll('晥', '皖');
    res = res.replaceAll('皹', '皸');
    res = res.replaceAll('蘯', '盪');
    res = res.replaceAll('眦', '眥');
    res = res.replaceAll('𥆩', '睨');
    res = res.replaceAll('瞪', '瞠');
    res = res.replaceAll('𥈞', '瞞');
    res = res.replaceAll('𥇥', '瞼');
    res = res.replaceAll('瞩', '矚');
    res = res.replaceAll('墝', '磽');
    res = res.replaceAll('禩', '祀');
    res = res.replaceAll('禀', '稟');
    res = res.replaceAll('㝫', '窿');
    res = res.replaceAll('𨗉', '邃');
    res = res.replaceAll('筺', '筐');
    res = res.replaceAll('笋', '筍');
    res = res.replaceAll('筝', '箏');
    res = res.replaceAll('籭', '篩');
    res = res.replaceAll('𥱋', '簗');
    res = res.replaceAll('筹', '籌');
    res = res.replaceAll('簱', '籏');
    res = res.replaceAll('籘', '籐');
    res = res.replaceAll('籖', '籤');
    res = res.replaceAll('秔', '粳');
    res = res.replaceAll('稉', '粳');
    res = res.replaceAll('糝', '糂');
    res = res.replaceAll('纊', '絋');
    res = res.replaceAll('縧', '絛');
    res = res.replaceAll('縉', '縉');
    res = res.replaceAll('緕', '纃');
    res = res.replaceAll('纘', '纉');
    res = res.replaceAll('䋝', '纓');
    res = res.replaceAll('䌫', '纜');
    res = res.replaceAll('䈇', '罩');
    res = res.replaceAll('羇', '羈');
    res = res.replaceAll('覊', '羈');
    res = res.replaceAll('覉', '羈');
    res = res.replaceAll('羗', '羌');
    res = res.replaceAll('羮', '羹');
    res = res.replaceAll('耊', '耋');
    res = res.replaceAll('伷', '胄');
    res = res.replaceAll('肧', '胚');
    res = res.replaceAll('𦙾', '脛');
    res = res.replaceAll('腟', '膣');
    res = res.replaceAll('𧸐', '膩');
    res = res.replaceAll('脍', '膾');
    res = res.replaceAll('𦜝', '臍');
    res = res.replaceAll('臈', '臘');
    res = res.replaceAll('﨟', '臘');
    res = res.replaceAll('㫪', '舂');
    res = res.replaceAll('𣇃', '舂');
    res = res.replaceAll('䑛', '舐');
    res = res.replaceAll('艣', '艪');
    res = res.replaceAll('舮', '艫');
    res = res.replaceAll('𦫿', '艾');
    res = res.replaceAll('蒭', '芻');
    res = res.replaceAll('苢', '苡');
    res = res.replaceAll('莓', '苺');
    res = res.replaceAll('荔', '茘');
    res = res.replaceAll('蒞', '莅');
    res = res.replaceAll('涖', '莅');
    res = res.replaceAll('蓱', '萍');
    res = res.replaceAll('茰', '萸');
    res = res.replaceAll('蕚', '萼');
    res = res.replaceAll('蔕', '蒂');
    res = res.replaceAll('薓', '蔘');
    res = res.replaceAll('䔥', '蕭');
    res = res.replaceAll('萕', '薺');
    res = res.replaceAll('蝨', '虱');
    res = res.replaceAll('螾', '蚓');
    res = res.replaceAll('蜙', '蚣');
    res = res.replaceAll('蚘', '蛔');
    res = res.replaceAll('蛕', '蛔');
    res = res.replaceAll('猬', '蝟');
    res = res.replaceAll('蜋', '螂');
    res = res.replaceAll('蟆', '蟇');
    res = res.replaceAll('蝼', '螻');
    res = res.replaceAll('蟒', '蠎');
    res = res.replaceAll('蠧', '蠹');
    res = res.replaceAll('螙', '蠹');
    res = res.replaceAll('衂', '衄');
    res = res.replaceAll('袵', '衽');
    res = res.replaceAll('褁', '裹');
    res = res.replaceAll('裵', '裴');
    res = res.replaceAll('㐮', '襄');
    res = res.replaceAll('褝', '襌');
    res = res.replaceAll('𧜎', '襷');
    res = res.replaceAll('覔', '覓');
    res = res.replaceAll('譌', '訛');
    res = res.replaceAll('諡', '謚');
    res = res.replaceAll('𧦅', '謳');
    res = res.replaceAll('讁', '謫');
    res = res.replaceAll('譛', '譖');
    res = res.replaceAll('醼', '讌');
    res = res.replaceAll('岈', '谺');
    res = res.replaceAll('豼', '貔');
    res = res.replaceAll('賍', '贓');
    res = res.replaceAll('𨂻', '蹈');
    res = res.replaceAll('𠌫', '蹕');
    res = res.replaceAll('踌', '躊');
    res = res.replaceAll('躪', '躙');
    res = res.replaceAll('躳', '躬');
    res = res.replaceAll('輙', '輒');
    res = res.replaceAll('輌', '輛');
    res = res.replaceAll('輀', '轜');
    res = res.replaceAll('䡎', '轤');
    res = res.replaceAll('逈', '迥');
    res = res.replaceAll('逷', '逖');
    res = res.replaceAll('逎', '遒');
    res = res.replaceAll('郄', '郤');
    res = res.replaceAll('𨥫', '鉚');
    res = res.replaceAll('𨦇', '鋏');
    res = res.replaceAll('鏥', '銹');
    res = res.replaceAll('鏽', '銹');
    res = res.replaceAll('𨪙', '鏘');
    res = res.replaceAll('鈩', '鑪');
    res = res.replaceAll('𨫝', '鑵');
    res = res.replaceAll('鑚', '鑽');
    res = res.replaceAll('鬧', '閙');
    res = res.replaceAll('閆', '閻');
    res = res.replaceAll('濶', '闊');
    res = res.replaceAll('𤄃', '闊');
    res = res.replaceAll('閴', '闃');
    res = res.replaceAll('徏', '陟');
    res = res.replaceAll('隯', '陦');
    res = res.replaceAll('騭', '隲');
    res = res.replaceAll('𨻫', '隴');
    res = res.replaceAll('隽', '雋');
    res = res.replaceAll('雝', '雍');
    res = res.replaceAll('鵰', '雕');
    res = res.replaceAll('鞱', '韜');
    res = res.replaceAll('韲', '齏');
    res = res.replaceAll('虀', '齏');
    res = res.replaceAll('𦣝', '頤');
    res = res.replaceAll('頥', '頤');
    res = res.replaceAll('飃', '飄');
    res = res.replaceAll('飈', '飆');
    res = res.replaceAll('颷', '飆');
    res = res.replaceAll('飇', '飆');
    res = res.replaceAll('颮', '飆');
    res = res.replaceAll('饟', '餉');
    res = res.replaceAll('䬻', '餞');
    res = res.replaceAll('𩜙', '饒');
    res = res.replaceAll('駞', '駝');
    res = res.replaceAll('驘', '騾');
    res = res.replaceAll('馿', '驢');
    res = res.replaceAll('髥', '髯');
    res = res.replaceAll('鬂', '鬢');
    res = res.replaceAll('髩', '鬢');
    res = res.replaceAll('䦰', '鬮');
    res = res.replaceAll('䰗', '鬮');
    res = res.replaceAll('魦', '鯊');
    res = res.replaceAll('鰛', '鰮');
    res = res.replaceAll('𩻄', '鰥');
    res = res.replaceAll('鼇', '鰲');
    res = res.replaceAll('魲', '鱸');
    res = res.replaceAll('鳬', '鳧');
    res = res.replaceAll('鵶', '鴉');
    res = res.replaceAll('鴂', '鴃');
    res = res.replaceAll('鵄', '鴟');
    res = res.replaceAll('鵞', '鵝');
    res = res.replaceAll('鶫', '鶇');
    res = res.replaceAll('鵾', '鶤');
    res = res.replaceAll('雚', '鸛');
    res = res.replaceAll('醎', '鹹');
    res = res.replaceAll('麤', '麁');
    res = res.replaceAll('麄', '麁');
    res = res.replaceAll('麸', '麩');
    res = res.replaceAll('麬', '麩');
    res = res.replaceAll('鱉', '鼈');
    res = res.replaceAll('齓', '齔');
    res = res.replaceAll('𪗱', '齟');
    res = res.replaceAll('𪘚', '齬');
    res = res.replaceAll('腭', '齶');
    res = res.replaceAll('涂', '凃');
    res = res.replaceAll('匀', '勻');
    res = res.replaceAll('壎', '塤');
    res = res.replaceAll('墪', '墩');
    res = res.replaceAll('𡉴', '壚');
    res = res.replaceAll('夔', '虁');
    res = res.replaceAll('孼', '孽');
    res = res.replaceAll('尩', '尫');
    res = res.replaceAll('𡶒', '岪');
    res = res.replaceAll('岭', '岺');
    res = res.replaceAll('嵇', '嵆');
    res = res.replaceAll('𡵸', '嶧');
    res = res.replaceAll('韘', '弽');
    res = res.replaceAll('𦿶', '彅');
    res = res.replaceAll('扡', '拖');
    res = res.replaceAll('拕', '拖');
    res = res.replaceAll('𢮦', '撿');
    res = res.replaceAll('昺', '昞');
    res = res.replaceAll('𣏓', '杇');
    res = res.replaceAll('梙', '槵');
    res = res.replaceAll('槖', '橐');
    res = res.replaceAll('篙', '㰏');
    res = res.replaceAll('濚', '滎');
    res = res.replaceAll('𤂖', '灝');
    res = res.replaceAll('㶚', '灞');
    res = res.replaceAll('灔', '灎');
    res = res.replaceAll('灩', '灎');
    res = res.replaceAll('牗', '牖');
    res = res.replaceAll('麞', '獐');
    res = res.replaceAll('珉', '玟');
    res = res.replaceAll('玨', '珏');
    res = res.replaceAll('璿', '璇');
    res = res.replaceAll('瓚', '瓉');
    res = res.replaceAll('暭', '皞');
    res = res.replaceAll('皡', '皞');
    res = res.replaceAll('碊', '𥒎');
    res = res.replaceAll('秭', '𥝱');
    res = res.replaceAll('筇', '笻');
    res = res.replaceAll('籰', '篗');
    res = res.replaceAll('㝬', '簠');
    res = res.replaceAll('𥻘', '粼');
    res = res.replaceAll('餻', '糕');
    res = res.replaceAll('綷', '紣');
    res = res.replaceAll('羐', '羑');
    res = res.replaceAll('聃', '耼');
    res = res.replaceAll('髕', '臏');
    res = res.replaceAll('莕', '荇');
    res = res.replaceAll('虯', '虬');
    res = res.replaceAll('彲', '螭');
    res = res.replaceAll('迆', '迤');
    res = res.replaceAll('䢵', '鄖');
    res = res.replaceAll('銿', '鏞');
    res = res.replaceAll('𨩱', '鏟');
    res = res.replaceAll('囟', '顖');
    res = res.replaceAll('飡', '飧');
    res = res.replaceAll('飱', '飧');
    res = res.replaceAll('鱔', '鱓');
    res = res.replaceAll('鸜', '鴝');
    res = res.replaceAll('鶿', '鷀');
    res = res.replaceAll('𡑭', '𡋗');
    res = res.replaceAll('掔', '孯');
    res = res.replaceAll('䆿', '寱');
    res = res.replaceAll('幮', '㡡');
    res = res.replaceAll('捙', '拽');
    res = res.replaceAll('斵', '斲');
    res = res.replaceAll('㯍', '槳');
    res = res.replaceAll('櫽', '檃');
    res = res.replaceAll('簋', '𣪘');
    res = res.replaceAll('灇', '潨');
    res = res.replaceAll('爫', '爫');
    res = res.replaceAll('豭', '猳');
    res = res.replaceAll('砆', '玞');
    res = res.replaceAll('瓺', '𤭖');
    res = res.replaceAll('畎', '甽');
    res = res.replaceAll('𤹪', '痀');
    res = res.replaceAll('㿗', '㿉');
    res = res.replaceAll('籅', '𥫣');
    res = res.replaceAll('𩝐', '糍');
    res = res.replaceAll('饎', '糦');
    res = res.replaceAll('纑', '䋆');
    res = res.replaceAll('罡', '𦊆');
    res = res.replaceAll('艹', '艹');
    res = res.replaceAll('𧑉', '蛗');
    res = res.replaceAll('覷', '覰');
    res = res.replaceAll('觿', '觽');
    res = res.replaceAll('豅', '𧯇');
    res = res.replaceAll('頳', '赬');
    res = res.replaceAll('䠖', '趦');
    res = res.replaceAll('辶', '辶');
    res = res.replaceAll('酆', '鄷');
    res = res.replaceAll('銲', '釬');
    res = res.replaceAll('𨯁', '𨫤');
    res = res.replaceAll('𩙿', '飠');
    res = res.replaceAll('鯘', '鮾');
    res = res.replaceAll('鱰', '鱪');
    res = res.replaceAll('㑨', '俣');
    res = res.replaceAll('㘅', '銜');
    res = res.replaceAll('啣', '銜');
    res = res.replaceAll('衘', '銜');
    res = res.replaceAll('亙', '亘');
    res = res.replaceAll('亯', '享');
    res = res.replaceAll('仐', '傘');
    res = res.replaceAll('僃', '備');
    res = res.replaceAll('兦', '亡');
    res = res.replaceAll('冨', '富');
    res = res.replaceAll('劵', '券');
    res = res.replaceAll('匜', '也');
    res = res.replaceAll('厡', '原');
    res = res.replaceAll('嗜', '呩');
    res = res.replaceAll('嘊', '啀');
    res = res.replaceAll('囧', '冏');
    res = res.replaceAll('夓', '夏');
    res = res.replaceAll('姊', '姉');
    res = res.replaceAll('嬝', '嫋');
    res = res.replaceAll('庽', '寓');
    res = res.replaceAll('彴', '仢');
    res = res.replaceAll('徰', '征');
    res = res.replaceAll('忈', '仁');
    res = res.replaceAll('怘', '固');
    res = res.replaceAll('恖', '思');
    res = res.replaceAll('恧', '忸');
    res = res.replaceAll('悧', '俐');
    res = res.replaceAll('憁', '愡');
    res = res.replaceAll('戧', '創');
    res = res.replaceAll('抉', '刔');
    res = res.replaceAll('挐', '拏');
    res = res.replaceAll('拿', '拏');
    res = res.replaceAll('揑', '捏');
    res = res.replaceAll('撘', '搭');
    res = res.replaceAll('擵', '摩');
    res = res.replaceAll('昦', '昊');
    res = res.replaceAll('昬', '昏');
    res = res.replaceAll('昻', '昂');
    res = res.replaceAll('晘', '旱');
    res = res.replaceAll('暻', '景');
    res = res.replaceAll('曾', '曽');
    res = res.replaceAll('枖', '夭');
    res = res.replaceAll('柂', '柁');
    res = res.replaceAll('柺', '枴');
    res = res.replaceAll('栅', '柵');
    res = res.replaceAll('榨', '搾');
    res = res.replaceAll('樃', '榔');
    res = res.replaceAll('樷', '叢');
    res = res.replaceAll('欉', '叢');
    res = res.replaceAll('藂', '叢');
    res = res.replaceAll('橊', '榴');
    res = res.replaceAll('欛', '杷');
    res = res.replaceAll('𣠽', '杷');
    res = res.replaceAll('氐', '柢');
    res = res.replaceAll('沲', '沱');
    res = res.replaceAll('溂', '剌');
    res = res.replaceAll('瀧', '滝');
    res = res.replaceAll('灕', '漓');
    res = res.replaceAll('熯', '暵');
    res = res.replaceAll('燈', '灯');
    res = res.replaceAll('爤', '爛');
    res = res.replaceAll('猂', '悍');
    res = res.replaceAll('獘', '弊');
    res = res.replaceAll('瓌', '瑰');
    res = res.replaceAll('甆', '瓷');
    res = res.replaceAll('癅', '瘤');
    res = res.replaceAll('矙', '瞰');
    res = res.replaceAll('秌', '秋');
    res = res.replaceAll('窶', '寠');
    res = res.replaceAll('竆', '窮');
    res = res.replaceAll('箟', '箘');
    res = res.replaceAll('箲', '筅');
    res = res.replaceAll('篇', '編');
    res = res.replaceAll('籒', '籀');
    res = res.replaceAll('糉', '粽');
    res = res.replaceAll('綂', '統');
    res = res.replaceAll('綗', '絅');
    res = res.replaceAll('繿', '襤');
    res = res.replaceAll('罓', '网');
    res = res.replaceAll('翦', '剪');
    res = res.replaceAll('脗', '吻');
    res = res.replaceAll('艢', '檣');
    res = res.replaceAll('芔', '卉');
    res = res.replaceAll('苅', '刈');
    res = res.replaceAll('荆', '荊');
    res = res.replaceAll('莾', '莽');
    res = res.replaceAll('蔞', '縷');
    res = res.replaceAll('蕐', '華');
    res = res.replaceAll('薶', '埋');
    res = res.replaceAll('蜄', '蜃');
    res = res.replaceAll('蜯', '蚌');
    res = res.replaceAll('蜹', '蚋');
    res = res.replaceAll('蠭', '蜂');
    res = res.replaceAll('衖', '巷');
    res = res.replaceAll('覩', '睹');
    res = res.replaceAll('訫', '信');
    res = res.replaceAll('詆', '呧');
    res = res.replaceAll('誡', '戒');
    res = res.replaceAll('諌', '諫');
    res = res.replaceAll('諵', '喃');
    res = res.replaceAll('謌', '歌');
    res = res.replaceAll('譼', '監');
    res = res.replaceAll('賬', '帳');
    res = res.replaceAll('贁', '敗');
    res = res.replaceAll('贗', '贋');
    res = res.replaceAll('趂', '趁');
    res = res.replaceAll('蹏', '蹄');
    res = res.replaceAll('蹯', '籵');
    res = res.replaceAll('躭', '耽');
    res = res.replaceAll('輺', '輜');
    res = res.replaceAll('轝', '輿');
    res = res.replaceAll('逬', '迸');
    res = res.replaceAll('逯', '逮');
    res = res.replaceAll('醆', '盞');
    res = res.replaceAll('鈾', '宙');
    res = res.replaceAll('錯', '厝');
    res = res.replaceAll('鍿', '錙');
    res = res.replaceAll('阱', '穽');
    res = res.replaceAll('陗', '峭');
    res = res.replaceAll('隁', '堰');
    res = res.replaceAll('隖', '塢');
    res = res.replaceAll('隟', '隙');
    res = res.replaceAll('隮', '躋');
    res = res.replaceAll('靃', '霍');
    res = res.replaceAll('靣', '面');
    res = res.replaceAll('鞵', '鞋');
    res = res.replaceAll('韤', '襪');
    res = res.replaceAll('餧', '餒');
    res = res.replaceAll('髗', '顱');
    res = res.replaceAll('髳', '髦');
    res = res.replaceAll('鬀', '剃');
    res = res.replaceAll('鬄', '髢');
    res = res.replaceAll('鰀', '鯇');
    res = res.replaceAll('鶪', '鵙');
    res = res.replaceAll('鷏', '鷆');
    res = res.replaceAll('龍', '竜');
    res = res.replaceAll('𢈘', '鹿');
    res = res.replaceAll('𦥑', '臼');
    res = res.replaceAll('蘒', '萩');
    res = res.replaceAll('祢', '禰');
    res = res.replaceAll('薗', '園');
    res = res.replaceAll('峯', '峰');
    res = res.replaceAll('羽', '羽');
    res = res.replaceAll('銳', '鋭');
    res = res.replaceAll('益', '益');
    res = res.replaceAll('悅', '悦');
    res = res.replaceAll('閱', '閲');
    res = res.replaceAll('閒', '間');
    res = res.replaceAll('館', '館');
    res = res.replaceAll('强', '強');
    res = res.replaceAll('敎', '教');
    res = res.replaceAll('契', '契');
    res = res.replaceAll('戶', '戸');
    res = res.replaceAll('吳', '呉');
    res = res.replaceAll('娛', '娯');
    res = res.replaceAll('歲', '歳');
    res = res.replaceAll('產', '産');
    res = res.replaceAll('飼', '飼');
    res = res.replaceAll('尙', '尚');
    res = res.replaceAll('淸', '清');
    res = res.replaceAll('精', '精');
    res = res.replaceAll('靑', '青');
    res = res.replaceAll('稅', '税');
    res = res.replaceAll('說', '説');
    res = res.replaceAll('絕', '絶');
    res = res.replaceAll('脫', '脱');
    res = res.replaceAll('彥', '彦');
    res = res.replaceAll('姬', '姫');
    res = res.replaceAll('廉', '廉');
    res = res.replaceAll('髙', '高');
    res = res.replaceAll('ｰ', 'ー');
    res = res.replaceAll('0', '０');
    res = res.replaceAll('1', '１');
    res = res.replaceAll('1.', '１');
    res = res.replaceAll('2', '２');
    res = res.replaceAll('2.', '２');
    res = res.replaceAll('3', '３');
    res = res.replaceAll('3.', '３');
    res = res.replaceAll('4', '４');
    res = res.replaceAll('4.', '４');
    res = res.replaceAll('5', '５');
    res = res.replaceAll('5.', '５');
    res = res.replaceAll('6', '６');
    res = res.replaceAll('6.', '６');
    res = res.replaceAll('7', '７');
    res = res.replaceAll('7.', '７');
    res = res.replaceAll('8', '８');
    res = res.replaceAll('8.', '８');
    res = res.replaceAll('9', '９');
    res = res.replaceAll('9.', '９');
    res = res.replaceAll('A', 'Ａ');
    res = res.replaceAll('B', 'Ｂ');
    res = res.replaceAll('C', 'Ｃ');
    res = res.replaceAll('D', 'Ｄ');
    res = res.replaceAll('E', 'Ｅ');
    res = res.replaceAll('F', 'Ｆ');
    res = res.replaceAll('G', 'Ｇ');
    res = res.replaceAll('H', 'Ｈ');
    res = res.replaceAll('I', 'Ｉ');
    res = res.replaceAll('J', 'Ｊ');
    res = res.replaceAll('K', 'Ｋ');
    res = res.replaceAll('L', 'Ｌ');
    res = res.replaceAll('M', 'Ｍ');
    res = res.replaceAll('N', 'Ｎ');
    res = res.replaceAll('O', 'Ｏ');
    res = res.replaceAll('P', 'Ｐ');
    res = res.replaceAll('Q', 'Ｑ');
    res = res.replaceAll('R', 'Ｒ');
    res = res.replaceAll('S', 'Ｓ');
    res = res.replaceAll('T', 'Ｔ');
    res = res.replaceAll('U', 'Ｕ');
    res = res.replaceAll('V', 'Ｖ');
    res = res.replaceAll('W', 'Ｗ');
    res = res.replaceAll('X', 'Ｘ');
    res = res.replaceAll('Y', 'Ｙ');
    res = res.replaceAll('Z', 'Ｚ');
    res = res.replaceAll('a', 'Ａ');
    res = res.replaceAll('b', 'Ｂ');
    res = res.replaceAll('c', 'Ｃ');
    res = res.replaceAll('d', 'Ｄ');
    res = res.replaceAll('e', 'Ｅ');
    res = res.replaceAll('f', 'Ｆ');
    res = res.replaceAll('g', 'Ｇ');
    res = res.replaceAll('h', 'Ｈ');
    res = res.replaceAll('i', 'Ｉ');
    res = res.replaceAll('j', 'Ｊ');
    res = res.replaceAll('k', 'Ｋ');
    res = res.replaceAll('l', 'Ｌ');
    res = res.replaceAll('m', 'Ｍ');
    res = res.replaceAll('n', 'Ｎ');
    res = res.replaceAll('o', 'Ｏ');
    res = res.replaceAll('p', 'Ｐ');
    res = res.replaceAll('q', 'Ｑ');
    res = res.replaceAll('r', 'Ｒ');
    res = res.replaceAll('s', 'Ｓ');
    res = res.replaceAll('t', 'Ｔ');
    res = res.replaceAll('u', 'Ｕ');
    res = res.replaceAll('v', 'Ｖ');
    res = res.replaceAll('w', 'Ｗ');
    res = res.replaceAll('x', 'Ｘ');
    res = res.replaceAll('y', 'Ｙ');
    res = res.replaceAll('z', 'Ｚ');
    res = res.replaceAll('À', 'Ａ');
    res = res.replaceAll('Á', 'Ａ');
    res = res.replaceAll('Â', 'Ａ');
    res = res.replaceAll('Ã', 'Ａ');
    res = res.replaceAll('Ä', 'Ａ');
    res = res.replaceAll('Å', 'Ａ');
    res = res.replaceAll('Æ', 'ＡＥ');
    res = res.replaceAll('Ç', 'Ｃ');
    res = res.replaceAll('È', 'Ｅ');
    res = res.replaceAll('É', 'Ｅ');
    res = res.replaceAll('Ê', 'Ｅ');
    res = res.replaceAll('Ì', 'Ｉ');
    res = res.replaceAll('Í', 'Ｉ');
    res = res.replaceAll('Î', 'Ｉ');
    res = res.replaceAll('Ï', 'Ｉ');
    res = res.replaceAll('Ñ', 'Ｎ');
    res = res.replaceAll('Ò', 'Ｏ');
    res = res.replaceAll('Ó', 'Ｏ');
    res = res.replaceAll('Ô', 'Ｏ');
    res = res.replaceAll('Õ', 'Ｏ');
    res = res.replaceAll('Ö', 'Ｏ');
    res = res.replaceAll('Ø', 'Ｏ');
    res = res.replaceAll('Ù', 'Ｕ');
    res = res.replaceAll('Ú', 'Ｕ');
    res = res.replaceAll('Û', 'Ｕ');
    res = res.replaceAll('Ü', 'Ｕ');
    res = res.replaceAll('Ý', 'Ｙ');
    res = res.replaceAll('ß', 'ＳＳ');
    res = res.replaceAll('à', 'Ａ');
    res = res.replaceAll('á', 'Ａ');
    res = res.replaceAll('â', 'Ａ');
    res = res.replaceAll('ã', 'Ａ');
    res = res.replaceAll('ä', 'Ａ');
    res = res.replaceAll('å', 'Ａ');
    res = res.replaceAll('æ', 'ＡＥ');
    res = res.replaceAll('ç', 'Ｃ');
    res = res.replaceAll('è', 'Ｅ');
    res = res.replaceAll('é', 'Ｅ');
    res = res.replaceAll('ê', 'Ｅ');
    res = res.replaceAll('ì', 'Ｉ');
    res = res.replaceAll('í', 'Ｉ');
    res = res.replaceAll('î', 'Ｉ');
    res = res.replaceAll('ï', 'Ｉ');
    res = res.replaceAll('ñ', 'Ｎ');
    res = res.replaceAll('ò', 'Ｏ');
    res = res.replaceAll('ó', 'Ｏ');
    res = res.replaceAll('ô', 'Ｏ');
    res = res.replaceAll('õ', 'Ｏ');
    res = res.replaceAll('ö', 'Ｏ');
    res = res.replaceAll('ø', 'Ｏ');
    res = res.replaceAll('ù', 'Ｕ');
    res = res.replaceAll('ú', 'Ｕ');
    res = res.replaceAll('û', 'Ｕ');
    res = res.replaceAll('ü', 'Ｕ');
    res = res.replaceAll('ý', 'Ｙ');
    res = res.replaceAll('ÿ', 'Ｙ');
    res = res.replaceAll('Ā', 'Ａ');
    res = res.replaceAll('ā', 'Ａ');
    res = res.replaceAll('Ă', 'Ａ');
    res = res.replaceAll('ă', 'Ａ');
    res = res.replaceAll('Ć', 'Ｃ');
    res = res.replaceAll('ć', 'Ｃ');
    res = res.replaceAll('Ĉ', 'Ｃ');
    res = res.replaceAll('ĉ', 'Ｃ');
    res = res.replaceAll('Ċ', 'Ｃ');
    res = res.replaceAll('ċ', 'Ｃ');
    res = res.replaceAll('Č', 'Ｃ');
    res = res.replaceAll('č', 'Ｃ');
    res = res.replaceAll('Ď', 'Ｄ');
    res = res.replaceAll('ď', 'Ｄ');
    res = res.replaceAll('Ē', 'Ｅ');
    res = res.replaceAll('ē', 'Ｅ');
    res = res.replaceAll('ĕ', 'Ｅ');
    res = res.replaceAll('Ė', 'Ｅ');
    res = res.replaceAll('ė', 'Ｅ');
    res = res.replaceAll('ę', 'Ｅ');
    res = res.replaceAll('Ě', 'Ｅ');
    res = res.replaceAll('ě', 'Ｅ');
    res = res.replaceAll('Ĝ', 'Ｇ');
    res = res.replaceAll('ĝ', 'Ｇ');
    res = res.replaceAll('Ğ', 'Ｇ');
    res = res.replaceAll('ğ', 'Ｇ');
    res = res.replaceAll('Ġ', 'Ｇ');
    res = res.replaceAll('ġ', 'Ｇ');
    res = res.replaceAll('Ĥ', 'Ｈ');
    res = res.replaceAll('ĥ', 'Ｈ');
    res = res.replaceAll('Ĩ', 'Ｉ');
    res = res.replaceAll('ĩ', 'Ｉ');
    res = res.replaceAll('Ī', 'Ｉ');
    res = res.replaceAll('ī', 'Ｉ');
    res = res.replaceAll('Ĭ', 'Ｉ');
    res = res.replaceAll('ĭ', 'Ｉ');
    res = res.replaceAll('İ', 'Ｉ');
    res = res.replaceAll('ı', 'Ｉ');
    res = res.replaceAll('Ĵ', 'Ｊ');
    res = res.replaceAll('ĵ', 'Ｊ');
    res = res.replaceAll('Ĺ', 'Ｌ');
    res = res.replaceAll('ĺ', 'Ｌ');
    res = res.replaceAll('Ľ', 'Ｌ');
    res = res.replaceAll('ľ', 'Ｌ');
    res = res.replaceAll('ł', 'Ｌ');
    res = res.replaceAll('Ń', 'Ｎ');
    res = res.replaceAll('ń', 'Ｎ');
    res = res.replaceAll('Ň', 'Ｎ');
    res = res.replaceAll('ň', 'Ｎ');
    res = res.replaceAll('Ō', 'Ｏ');
    res = res.replaceAll('ō', 'Ｏ');
    res = res.replaceAll('Ŏ', 'Ｏ');
    res = res.replaceAll('ŏ', 'Ｏ');
    res = res.replaceAll('Œ', 'ＯＥ');
    res = res.replaceAll('œ', 'ＯＥ');
    res = res.replaceAll('Ŕ', 'Ｒ');
    res = res.replaceAll('ŕ', 'Ｒ');
    res = res.replaceAll('Ř', 'Ｒ');
    res = res.replaceAll('ř', 'Ｒ');
    res = res.replaceAll('Ś', 'Ｓ');
    res = res.replaceAll('ś', 'Ｓ');
    res = res.replaceAll('Ŝ', 'Ｓ');
    res = res.replaceAll('ŝ', 'Ｓ');
    res = res.replaceAll('ş', 'Ｓ');
    res = res.replaceAll('Š', 'Ｓ');
    res = res.replaceAll('š', 'Ｓ');
    res = res.replaceAll('Ť', 'Ｔ');
    res = res.replaceAll('ť', 'Ｔ');
    res = res.replaceAll('Ũ', 'Ｕ');
    res = res.replaceAll('ũ', 'Ｕ');
    res = res.replaceAll('Ū', 'Ｕ');
    res = res.replaceAll('ū', 'Ｕ');
    res = res.replaceAll('Ŭ', 'Ｕ');
    res = res.replaceAll('ŭ', 'Ｕ');
    res = res.replaceAll('ů', 'Ｕ');
    res = res.replaceAll('Ŵ', 'Ｗ');
    res = res.replaceAll('ŵ', 'Ｗ');
    res = res.replaceAll('Ŷ', 'Ｙ');
    res = res.replaceAll('ŷ', 'Ｙ');
    res = res.replaceAll('Ÿ', 'Ｙ');
    res = res.replaceAll('Ź', 'Ｚ');
    res = res.replaceAll('ź', 'Ｚ');
    res = res.replaceAll('Ż', 'Ｚ');
    res = res.replaceAll('ż', 'Ｚ');
    res = res.replaceAll('Ž', 'Ｚ');
    res = res.replaceAll('ž', 'Ｚ');
    res = res.replaceAll('ǧ', 'Ｇ');
    res = res.replaceAll('Ǵ', 'Ｇ');
    res = res.replaceAll('ǵ', 'Ｇ');
    res = res.replaceAll('Ё', 'Ｅ');
    res = res.replaceAll('А', 'Ａ');
    res = res.replaceAll('Б', 'Ｂ');
    res = res.replaceAll('В', 'Ｖ');
    res = res.replaceAll('Г', 'Ｇ');
    res = res.replaceAll('Д', 'Ｄ');
    res = res.replaceAll('Е', 'Ｅ');
    res = res.replaceAll('Ж', 'ＺＨ');
    res = res.replaceAll('З', 'Ｚ');
    res = res.replaceAll('И', 'Ｉ');
    res = res.replaceAll('Й', 'Ｉ');
    res = res.replaceAll('К', 'Ｋ');
    res = res.replaceAll('Л', 'Ｌ');
    res = res.replaceAll('М', 'Ｍ');
    res = res.replaceAll('Н', 'Ｎ');
    res = res.replaceAll('О', 'Ｏ');
    res = res.replaceAll('П', 'Ｐ');
    res = res.replaceAll('Р', 'Ｒ');
    res = res.replaceAll('С', 'Ｓ');
    res = res.replaceAll('Т', 'Ｔ');
    res = res.replaceAll('У', 'Ｕ');
    res = res.replaceAll('Ф', 'Ｆ');
    res = res.replaceAll('Х', 'ＫＨ');
    res = res.replaceAll('Ц', 'ＴＳ');
    res = res.replaceAll('Ч', 'ＣＨ');
    res = res.replaceAll('Ш', 'ＳＨ');
    res = res.replaceAll('Щ', 'ＳＨＣＨ');
    res = res.replaceAll('Ы', 'Ｙ');
    res = res.replaceAll('Э', 'Ｅ');
    res = res.replaceAll('Ю', 'ＩＵ');
    res = res.replaceAll('Я', 'ＩＡ');
    res = res.replaceAll('а', 'Ａ');
    res = res.replaceAll('б', 'Ｂ');
    res = res.replaceAll('в', 'Ｖ');
    res = res.replaceAll('г', 'Ｇ');
    res = res.replaceAll('д', 'Ｄ');
    res = res.replaceAll('е', 'Ｅ');
    res = res.replaceAll('ж', 'ＺＨ');
    res = res.replaceAll('з', 'Ｚ');
    res = res.replaceAll('и', 'Ｉ');
    res = res.replaceAll('й', 'Ｉ');
    res = res.replaceAll('к', 'Ｋ');
    res = res.replaceAll('л', 'Ｌ');
    res = res.replaceAll('м', 'Ｍ');
    res = res.replaceAll('н', 'Ｎ');
    res = res.replaceAll('о', 'Ｏ');
    res = res.replaceAll('п', 'Ｐ');
    res = res.replaceAll('р', 'Ｒ');
    res = res.replaceAll('с', 'Ｓ');
    res = res.replaceAll('т', 'Ｔ');
    res = res.replaceAll('у', 'ｕ');
    res = res.replaceAll('ф', 'Ｆ');
    res = res.replaceAll('х', 'ＫＨ');
    res = res.replaceAll('ц', 'ＴＳ');
    res = res.replaceAll('ч', 'ＣＨ');
    res = res.replaceAll('ш', 'ＳＨ');
    res = res.replaceAll('щ', 'ＳＨＣＨ');
    res = res.replaceAll('ы', 'ｙ');
    res = res.replaceAll('э', 'Ｅ');
    res = res.replaceAll('ю', 'ＩＵ');
    res = res.replaceAll('я', 'ＩＡ');
    res = res.replaceAll('ё', 'Ｅ');
    res = res.replaceAll('Ḃ', 'Ｂ');
    res = res.replaceAll('ḃ', 'Ｂ');
    res = res.replaceAll('Ḋ', 'Ｄ');
    res = res.replaceAll('ḋ', 'Ｄ');
    res = res.replaceAll('Ḟ', 'Ｆ');
    res = res.replaceAll('ḟ', 'Ｆ');
    res = res.replaceAll('Ḡ', 'Ｇ');
    res = res.replaceAll('ḡ', 'Ｇ');
    res = res.replaceAll('Ḣ', 'Ｈ');
    res = res.replaceAll('ḣ', 'Ｈ');
    res = res.replaceAll('ḥ', 'Ｈ');
    res = res.replaceAll('Ḧ', 'Ｈ');
    res = res.replaceAll('ḧ', 'Ｈ');
    res = res.replaceAll('Ḱ', 'Ｋ');
    res = res.replaceAll('ḱ', 'Ｋ');
    res = res.replaceAll('Ḿ', 'Ｍ');
    res = res.replaceAll('ḿ', 'Ｍ');
    res = res.replaceAll('Ṁ', 'Ｍ');
    res = res.replaceAll('ṁ', 'Ｍ');
    res = res.replaceAll('Ṅ', 'Ｎ');
    res = res.replaceAll('ṅ', 'Ｎ');
    res = res.replaceAll('ṇ', 'Ｎ');
    res = res.replaceAll('Ṕ', 'Ｐ');
    res = res.replaceAll('ṕ', 'Ｐ');
    res = res.replaceAll('Ṗ', 'Ｐ');
    res = res.replaceAll('ṗ', 'Ｐ');
    res = res.replaceAll('Ṙ', 'Ｒ');
    res = res.replaceAll('ṙ', 'Ｒ');
    res = res.replaceAll('ṛ', 'Ｒ');
    res = res.replaceAll('Ṡ', 'Ｓ');
    res = res.replaceAll('ṡ', 'Ｓ');
    res = res.replaceAll('ṣ', 'Ｓ');
    res = res.replaceAll('Ṫ', 'Ｔ');
    res = res.replaceAll('ṫ', 'Ｔ');
    res = res.replaceAll('ṭ', 'Ｔ');
    res = res.replaceAll('Ṽ', 'Ｖ');
    res = res.replaceAll('ṽ', 'Ｖ');
    res = res.replaceAll('Ẁ', 'Ｗ');
    res = res.replaceAll('ẁ', 'Ｗ');
    res = res.replaceAll('Ẃ', 'Ｗ');
    res = res.replaceAll('ẃ', 'Ｗ');
    res = res.replaceAll('Ẅ', 'Ｗ');
    res = res.replaceAll('ẅ', 'Ｗ');
    res = res.replaceAll('Ẇ', 'Ｗ');
    res = res.replaceAll('ẇ', 'Ｗ');
    res = res.replaceAll('Ẋ', 'Ｘ');
    res = res.replaceAll('ẋ', 'Ｘ');
    res = res.replaceAll('Ẍ', 'Ｘ');
    res = res.replaceAll('ẍ', 'Ｘ');
    res = res.replaceAll('Ẏ', 'Ｙ');
    res = res.replaceAll('ẏ', 'Ｙ');
    res = res.replaceAll('Ẑ', 'Ｚ');
    res = res.replaceAll('ẑ', 'Ｚ');
    res = res.replaceAll('ẓ', 'Ｚ');
    res = res.replaceAll('ẗ', 'Ｔ');
    res = res.replaceAll('Ẽ', 'Ｅ');
    res = res.replaceAll('ẽ', 'Ｅ');
    res = res.replaceAll('Ỳ', 'Ｙ');
    res = res.replaceAll('ỳ', 'Ｙ');
    res = res.replaceAll('Ỹ', 'Ｙ');
    res = res.replaceAll('ỹ', 'Ｙ');
    res = res.replaceAll('№', 'ＮＯ');
    res = res.replaceAll('Ⅰ', '１');
    res = res.replaceAll('Ⅱ', '２');
    res = res.replaceAll('Ⅲ', '３');
    res = res.replaceAll('Ⅳ', '４');
    res = res.replaceAll('Ⅴ', '５');
    res = res.replaceAll('Ⅵ', '６');
    res = res.replaceAll('Ⅶ', '７');
    res = res.replaceAll('Ⅷ', '８');
    res = res.replaceAll('Ⅸ', '９');
    res = res.replaceAll('Ⅹ', '１０');
    res = res.replaceAll('ⅰ', '１');
    res = res.replaceAll('ⅱ', '２');
    res = res.replaceAll('ⅲ', '３');
    res = res.replaceAll('ⅳ', '４');
    res = res.replaceAll('ⅴ', '５');
    res = res.replaceAll('ⅵ', '６');
    res = res.replaceAll('ⅶ', '７');
    res = res.replaceAll('ⅷ', '８');
    res = res.replaceAll('ⅸ', '９');
    res = res.replaceAll('ⅹ', '１０');
    res = res.replaceAll('①', '１');
    res = res.replaceAll('②', '２');
    res = res.replaceAll('③', '３');
    res = res.replaceAll('④', '４');
    res = res.replaceAll('⑤', '５');
    res = res.replaceAll('⑥', '６');
    res = res.replaceAll('⑦', '７');
    res = res.replaceAll('⑧', '８');
    res = res.replaceAll('⑨', '９');
    res = res.replaceAll('⑩', '１０');
    res = res.replaceAll('⑪', '１１');
    res = res.replaceAll('⑫', '１２');
    res = res.replaceAll('⑬', '１３');
    res = res.replaceAll('⑭', '１４');
    res = res.replaceAll('⑮', '１５');
    res = res.replaceAll('⑯', '１６');
    res = res.replaceAll('⑰', '１７');
    res = res.replaceAll('⑱', '１８');
    res = res.replaceAll('⑲', '１９');
    res = res.replaceAll('⑳', '２０');
    res = res.replaceAll('Ⓟ', 'Ｐ');
    res = res.replaceAll('ぁ', 'ア');
    res = res.replaceAll('ぃ', 'イ');
    res = res.replaceAll('ぅ', 'ウ');
    res = res.replaceAll('ぇ', 'エ');
    res = res.replaceAll('ぉ', 'オ');
    res = res.replaceAll('っ', 'ツ');
    res = res.replaceAll('ゃ', 'ヤ');
    res = res.replaceAll('ゅ', 'ユ');
    res = res.replaceAll('ょ', 'ヨ');
    res = res.replaceAll('ゎ', 'ワ');
    res = res.replaceAll('ゐ', 'イ');
    res = res.replaceAll('ゑ', 'エ');
    res = res.replaceAll('ァ', 'ア');
    res = res.replaceAll('ィ', 'イ');
    res = res.replaceAll('ゥ', 'ウ');
    res = res.replaceAll('ェ', 'エ');
    res = res.replaceAll('ォ', 'オ');
    res = res.replaceAll('ヂ', 'ジ');
    res = res.replaceAll('ッ', 'ツ');
    res = res.replaceAll('ヅ', 'ズ');
    res = res.replaceAll('ャ', 'ヤ');
    res = res.replaceAll('ュ', 'ユ');
    res = res.replaceAll('ョ', 'ヨ');
    res = res.replaceAll('ヰ', 'イ');
    res = res.replaceAll('ヱ', 'エ');
    res = res.replaceAll('ヴ', 'ブ');
    res = res.replaceAll('ヴァ', 'バ');
    res = res.replaceAll('ヴィ', 'ビ');
    res = res.replaceAll('ヴゥ', 'ブ');
    res = res.replaceAll('ヴェ', 'ベ');
    res = res.replaceAll('ヴォ', 'ボ');
    res = res.replaceAll('ヵ', 'カ');
    res = res.replaceAll('ヶ', 'ケ');
    res = res.replaceAll('㈱', '株');
    res = res.replaceAll('㊙', '秘');
    res = res.replaceAll('㎏', 'ＫＧ');
    res = res.replaceAll('㎝', 'ＣＭ');
    res = res.replaceAll('㎞', 'ＫＭ');
    res = res.replaceAll('㎡', 'Ｍ２');
    res = res.replaceAll('ａ', 'Ａ');
    res = res.replaceAll('ｂ', 'Ｂ');
    res = res.replaceAll('ｃ', 'Ｃ');
    res = res.replaceAll('ｄ', 'Ｄ');
    res = res.replaceAll('ｅ', 'Ｅ');
    res = res.replaceAll('ｆ', 'Ｆ');
    res = res.replaceAll('ｇ', 'Ｇ');
    res = res.replaceAll('ｈ', 'Ｈ');
    res = res.replaceAll('ｉ', 'Ｉ');
    res = res.replaceAll('ｊ', 'Ｊ');
    res = res.replaceAll('ｋ', 'Ｋ');
    res = res.replaceAll('ｌ', 'Ｌ');
    res = res.replaceAll('ｍ', 'Ｍ');
    res = res.replaceAll('ｎ', 'Ｎ');
    res = res.replaceAll('ｏ', 'Ｏ');
    res = res.replaceAll('ｐ', 'Ｐ');
    res = res.replaceAll('ｑ', 'Ｑ');
    res = res.replaceAll('ｒ', 'Ｒ');
    res = res.replaceAll('ｓ', 'Ｓ');
    res = res.replaceAll('ｔ', 'Ｔ');
    res = res.replaceAll('ｕ', 'Ｕ');
    res = res.replaceAll('ｖ', 'Ｖ');
    res = res.replaceAll('ｗ', 'Ｗ');
    res = res.replaceAll('ｘ', 'Ｘ');
    res = res.replaceAll('ｙ', 'Ｙ');
    res = res.replaceAll('ｚ', 'Ｚ');
    res = res.replaceAll('ｦ', 'ヲ');
    res = res.replaceAll('ｧ', 'ア');
    res = res.replaceAll('ｨ', 'イ');
    res = res.replaceAll('ｩ', 'ウ');
    res = res.replaceAll('ｪ', 'エ');
    res = res.replaceAll('ｫ', 'オ');
    res = res.replaceAll('ｬ', 'ヤ');
    res = res.replaceAll('ｭ', 'ユ');
    res = res.replaceAll('ｮ', 'ヨ');
    res = res.replaceAll('ｯ', 'ツ');
    res = res.replaceAll('ｱ', 'ア');
    res = res.replaceAll('ｲ', 'イ');
    res = res.replaceAll('ｳ', 'ウ');
    res = res.replaceAll('ｳﾞ', 'ブ');
    res = res.replaceAll('ｳﾞｧ', 'バ');
    res = res.replaceAll('ｳﾞｨ', 'ビ');
    res = res.replaceAll('ｳﾞｩ', 'ブ');
    res = res.replaceAll('ｳﾞｪ', 'ベ');
    res = res.replaceAll('ｳﾞｫ', 'ボ');
    res = res.replaceAll('ｴ', 'エ');
    res = res.replaceAll('ｵ', 'オ');
    res = res.replaceAll('ｶ', 'カ');
    res = res.replaceAll('ｶﾞ', 'ガ');
    res = res.replaceAll('ｷ', 'キ');
    res = res.replaceAll('ｷﾞ', 'ギ');
    res = res.replaceAll('ｸ', 'ク');
    res = res.replaceAll('ｸﾞ', 'グ');
    res = res.replaceAll('ｹ', 'ケ');
    res = res.replaceAll('ｹﾞ', 'ゲ');
    res = res.replaceAll('ｺ', 'コ');
    res = res.replaceAll('ｺﾞ', 'ゴ');
    res = res.replaceAll('ｻ', 'サ');
    res = res.replaceAll('ｻﾞ', 'ザ');
    res = res.replaceAll('ｼ', 'シ');
    res = res.replaceAll('ｼﾞ', 'ジ');
    res = res.replaceAll('ｽ', 'ス');
    res = res.replaceAll('ｽﾞ', 'ズ');
    res = res.replaceAll('ｾ', 'セ');
    res = res.replaceAll('ｾﾞ', 'ゼ');
    res = res.replaceAll('ｿ', 'ソ');
    res = res.replaceAll('ｿﾞ', 'ゾ');
    res = res.replaceAll('ﾀ', 'タ');
    res = res.replaceAll('ﾀﾞ', 'ダ');
    res = res.replaceAll('ﾁ', 'チ');
    res = res.replaceAll('ﾁﾞ', 'ジ');
    res = res.replaceAll('ﾂ', 'ツ');
    res = res.replaceAll('ﾂﾞ', 'ズ');
    res = res.replaceAll('ﾃ', 'テ');
    res = res.replaceAll('ﾃﾞ', 'デ');
    res = res.replaceAll('ﾄ', 'ト');
    res = res.replaceAll('ﾄﾞ', 'ド');
    res = res.replaceAll('ﾅ', 'ナ');
    res = res.replaceAll('ﾆ', 'ニ');
    res = res.replaceAll('ﾇ', 'ヌ');
    res = res.replaceAll('ﾈ', 'ネ');
    res = res.replaceAll('ﾉ', 'ノ');
    res = res.replaceAll('ﾊ', 'ハ');
    res = res.replaceAll('ﾊﾞ', 'バ');
    res = res.replaceAll('ﾊﾟ', 'パ');
    res = res.replaceAll('ﾋ', 'ヒ');
    res = res.replaceAll('ﾋﾞ', 'ビ');
    res = res.replaceAll('ﾋﾟ', 'ピ');
    res = res.replaceAll('ﾌ', 'フ');
    res = res.replaceAll('ﾌﾞ', 'ブ');
    res = res.replaceAll('ﾌﾟ', 'プ');
    res = res.replaceAll('ﾍ', 'ヘ');
    res = res.replaceAll('ﾍﾞ', 'ベ');
    res = res.replaceAll('ﾍﾟ', 'ペ');
    res = res.replaceAll('ﾎ', 'ホ');
    res = res.replaceAll('ﾎﾞ', 'ボ');
    res = res.replaceAll('ﾎﾟ', 'ポ');
    res = res.replaceAll('ﾏ', 'マ');
    res = res.replaceAll('ﾐ', 'ミ');
    res = res.replaceAll('ﾑ', 'ム');
    res = res.replaceAll('ﾒ', 'メ');
    res = res.replaceAll('ﾓ', 'モ');
    res = res.replaceAll('ﾔ', 'ヤ');
    res = res.replaceAll('ﾕ', 'ユ');
    res = res.replaceAll('ﾖ', 'ヨ');
    res = res.replaceAll('ﾗ', 'ラ');
    res = res.replaceAll('ﾘ', 'リ');
    res = res.replaceAll('ﾙ', 'ル');
    res = res.replaceAll('ﾚ', 'レ');
    res = res.replaceAll('ﾛ', 'ロ');
    res = res.replaceAll('ﾜ', 'ワ');
    res = res.replaceAll('ﾝ', 'ン');
    res = res.replaceAll('新撰組', '新選組');
    res = res.replaceAll('Ⅺ', '１１');
    res = res.replaceAll('Ⅻ', '１２');
    res = res.replaceAll('㋿', '令和');
    res = res.replaceAll('ⅺ', '１１');
    res = res.replaceAll('ⅻ', '１２');
    res = res.replaceAll('あ', 'ア');
    res = res.replaceAll('い', 'イ');
    res = res.replaceAll('う', 'ウ');
    res = res.replaceAll('え', 'エ');
    res = res.replaceAll('お', 'オ');
    res = res.replaceAll('か', 'カ');
    res = res.replaceAll('が', 'ガ');
    res = res.replaceAll('き', 'キ');
    res = res.replaceAll('ぎ', 'ギ');
    res = res.replaceAll('く', 'ク');
    res = res.replaceAll('ぐ', 'グ');
    res = res.replaceAll('け', 'ケ');
    res = res.replaceAll('げ', 'ゲ');
    res = res.replaceAll('こ', 'コ');
    res = res.replaceAll('ご', 'ゴ');
    res = res.replaceAll('さ', 'サ');
    res = res.replaceAll('ざ', 'ザ');
    res = res.replaceAll('し', 'シ');
    res = res.replaceAll('じ', 'ジ');
    res = res.replaceAll('す', 'ス');
    res = res.replaceAll('ず', 'ズ');
    res = res.replaceAll('せ', 'セ');
    res = res.replaceAll('ぜ', 'ゼ');
    res = res.replaceAll('そ', 'ソ');
    res = res.replaceAll('ぞ', 'ゾ');
    res = res.replaceAll('た', 'タ');
    res = res.replaceAll('だ', 'ダ');
    res = res.replaceAll('ち', 'チ');
    res = res.replaceAll('ぢ', 'ジ');
    res = res.replaceAll('つ', 'ツ');
    res = res.replaceAll('づ', 'ズ');
    res = res.replaceAll('て', 'テ');
    res = res.replaceAll('で', 'デ');
    res = res.replaceAll('と', 'ト');
    res = res.replaceAll('ど', 'ド');
    res = res.replaceAll('な', 'ナ');
    res = res.replaceAll('に', 'ニ');
    res = res.replaceAll('ぬ', 'ヌ');
    res = res.replaceAll('ね', 'ネ');
    res = res.replaceAll('の', 'ノ');
    res = res.replaceAll('は', 'ハ');
    res = res.replaceAll('ば', 'バ');
    res = res.replaceAll('ぱ', 'パ');
    res = res.replaceAll('ひ', 'ヒ');
    res = res.replaceAll('び', 'ビ');
    res = res.replaceAll('ぴ', 'ピ');
    res = res.replaceAll('ふ', 'フ');
    res = res.replaceAll('ぶ', 'ブ');
    res = res.replaceAll('ぷ', 'プ');
    res = res.replaceAll('へ', 'ヘ');
    res = res.replaceAll('べ', 'ベ');
    res = res.replaceAll('ぺ', 'ペ');
    res = res.replaceAll('ほ', 'ホ');
    res = res.replaceAll('ぼ', 'ボ');
    res = res.replaceAll('ぽ', 'ポ');
    res = res.replaceAll('ま', 'マ');
    res = res.replaceAll('み', 'ミ');
    res = res.replaceAll('む', 'ム');
    res = res.replaceAll('め', 'メ');
    res = res.replaceAll('も', 'モ');
    res = res.replaceAll('や', 'ヤ');
    res = res.replaceAll('ゆ', 'ユ');
    res = res.replaceAll('よ', 'ヨ');
    res = res.replaceAll('ら', 'ラ');
    res = res.replaceAll('り', 'リ');
    res = res.replaceAll('る', 'ル');
    res = res.replaceAll('れ', 'レ');
    res = res.replaceAll('ろ', 'ロ');
    res = res.replaceAll('わ', 'ワ');
    res = res.replaceAll('を', 'ヲ');
    res = res.replaceAll('ん', 'ン');
    res = res.replaceAll('ゔ', 'ブ');
    res = res.replaceAll('ゕ', 'カ');
    res = res.replaceAll('ゖ', 'ケ');
    res = res.replaceAll('ヷ', 'ワ');
    res = res.replaceAll('ヸ', 'イ');
    res = res.replaceAll('ヹ', 'エ');
    res = res.replaceAll('ヺ', 'ヲ');
    res = res.replaceAll('ㇰ', 'ク');
    res = res.replaceAll('ㇱ', 'シ');
    res = res.replaceAll('ㇲ', 'ス');
    res = res.replaceAll('ㇳ', 'ト');
    res = res.replaceAll('ㇴ', 'ヌ');
    res = res.replaceAll('ㇵ', 'ハ');
    res = res.replaceAll('ㇶ', 'ヒ');
    res = res.replaceAll('ㇷ', 'フ');
    res = res.replaceAll('ㇸ', 'ヘ');
    res = res.replaceAll('ㇹ', 'ホ');
    res = res.replaceAll('ㇺ', 'ム');
    res = res.replaceAll('ㇻ', 'ラ');
    res = res.replaceAll('ㇼ', 'リ');
    res = res.replaceAll('ㇽ', 'ル');
    res = res.replaceAll('ㇾ', 'レ');
    res = res.replaceAll('ㇿ', 'ロ');
    res = res.replaceAll('ゔぁ', 'バ');
    res = res.replaceAll('ゔぃ', 'ビ');
    res = res.replaceAll('ゔぅ', 'ブ');
    res = res.replaceAll('ゔぇ', 'ベ');
    res = res.replaceAll('ゔぉ', 'ボ');

    //全角スペースを半角スペースに
    res = res.replaceAll('　', ' ');
    //連続するスペースの1つのスペースに
    res = res.replace( / +/g , ' ');
    //両端全角スペースの除去
    res = res.trim();
    return res;
  }
  return (
    <div>
      <div id="head">
        <div id="search_area">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              isSearch();
            }}
          >
            <label htmlFor="search_box">
              <span>検索</span>
              <input
              id="search_box"
              type="text"
              placeholder="キーワード"
              onChange={(e) => setSearchKw(e.target.value)}
              onKeyDown={(e) =>{
                if(e.key === 'Enter'){
                  isSearch();
                }
              }}
            />
            </label>
            <button id="search_btn" type="submit">検索</button>
          </form>
          <span id="msg" ref={msgRef} tabIndex={-1}>{msg}</span>
        </div>

        <div id="page_area">
          <input
              id="page_box"
              type="text"
              value={selectedPage}
              onChange={handleChangePage}
              onKeyDown={(e) =>{
                if(e.key === 'Enter'){
                  checkSetPage();
                }
              }}
            />
            <span>／</span><span>{totalPage}</span>
            <button
              id="to_page"
              aria-label="ページ遷移"
              onClick={() =>checkSetPage()}
            >
            </button>
        </div>
      </div>

      <div
        id="wrap"
        className={sideFlg === 'result' ? 'result_opn':''}
      >
        <div id="side">
          <div id="tmb_area">
            <dl>
            {imageUrl.map((item, index) => (
              <div
                key={index}
                id={`p${index + 1}`}
                className={currentPage === index ? 'current_img':''}
              >
                <dt>
                <img
                  src={item.url}
                  alt={`${index + 1}ページ`}
                  onClick={() =>toPage(index)}
                  onKeyDown={(e) => {
                    if(e.key === 'Enter'){
                      toPage(index)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  loading="lazy"
                 />
                </dt>
                <dd>{index + 1}</dd>
              </div>
            ))}
            </dl>
          </div>

          <div id="result_area"><div id="txt0"></div>
          {filteringData.map((item, index) => (
            <div key={index} id={`txt${index + 1}`}>
              {item.LINE.map((line:any,lineIndex:number) =>(
                <span
                  key={lineIndex}
                  className={selectedFlg===`${index}_${lineIndex}` ? 'selected': ''}
                  onClick={()=>toPage(index,line['@_X'],line['@_Y'],line['@_WIDTH'],line['@_HEIGHT'],lineIndex)}
                >
                  【{index + 1}】【{line['@_STRING']}】
                </span>
              ))}
            </div>
          ))}
          </div>
        </div>

        <div ref={viewerRef} id="viewer-image" />
        <button id="left_arrow" aria-label="前頁" onClick={()=>{toNextPage()}} disabled={inactive === 'last'}></button>
        <button id="right_arrow" aria-label="次頁" onClick={()=>{handlePrevious()}}disabled={inactive === 'first'}></button>
      </div>
      
      <div id="foot">
        <div id="operation_buttons">
          <button id="next" onClick={toNextPage} aria-label='次頁'></button>
          <button id="previous" onClick={handlePrevious} aria-label='前頁'></button>
          <button id="fullscreen" aria-label="全画面表示"></button>
          <button id="reset" aria-label="リセット" onClick={isReset}></button>
          <button id="zoom-in" aria-label="拡大"></button>
          <button id="zoom-out" aria-label="縮小"></button>
          <button id="rotate-left" aria-label="左回転"></button>
          <button id="rotate-right" aria-label="右回転"></button>
        </div>
      </div>
    </div>
  );
};

export default OpenSeaDragonViewer;
