// 圖片上傳&儲存



//上傳 
document.getElementById("upload-form").addEventListener("submit",async function(e) {
  e.preventDefault(); 
  const formData = new FormData(this);  
  
  // 將檔案打包起來
  const response = await fetch("/uploadPhoto/",{
    method: "POST",
    headers: {"X-CSRFToken": getCookie("csrftoken")},
    body: formData,
  });

  // 回傳json
  const data = await response.json();
  console.log(data);

  if (data.id){
    alert("上傳成功")
  }
  
})

// 監聽事件
document.getElementById("photo-input").addEventListener("change",function(){

  // 移除disabled
  document.getElementById("upload-submit").disabled = false;
  
  
})