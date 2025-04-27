import { useLocation } from "react-router-dom";
import { useState } from 'react';

interface MyItem {
  message: string;
}

const Show = () =>{
  const [repo_Data, setResponseData] = useState(null);
  
  const location = useLocation();
  const resultData = location.state?.resultData;
  const [selectedItems, setSelectedItems] = useState<string[]>([]);


  const handleCheckboxChange = (item : string ) => {
    setSelectedItems(prev =>
      prev.includes(item)
        ? prev.filter(i => i !== item)  // 取消選取
        : [...prev, item]               // 新增選取
    );
  };

  const handleSubmit = async () => {
    const repoName = 'git_practice';
    const response = await fetch(`http://localhost:8000/github/analyze/${repoName}/${selectedItems}`, {
      method: "GET",
    });
    const responseData = await response.json();
    setResponseData(responseData);
    console.log("finish");
  };
  return (
    <div className="p-4">

      <h2 className="text-lg font-bold mb-2">選擇commit:</h2>
      {resultData?.map((item:MyItem,index:number ) => (
        <label key={index} className="block mb-1">
          <input
            type="checkbox"
            checked={selectedItems.includes(item.message)}
            onChange={() => handleCheckboxChange(item.message)}
            className="mr-2"
          />
          {item.message}
        </label>
      ))}

      <button
        onClick={handleSubmit}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        送出到後端
      </button>
      {repo_Data && <p>{JSON.stringify(repo_Data, null, 2)}</p>}
    </div>
  );
}

export default Show;
