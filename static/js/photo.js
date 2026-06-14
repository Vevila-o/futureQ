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
    document.getElementById("photo-thumb").src = photoObjectURL;
    document.getElementById("phase-upload").classList.add("hidden");
    document.getElementById("phase-record").classList.remove("hidden");
  }
  
})

let photoObjectURL = null;

// 監聽事件
document.getElementById("photo-input").addEventListener("change",function(){

  // 移除disabled
  document.getElementById("upload-submit").disabled = false;

  // 顯示預覽
  const file = this.files[0];
  if (file) {
    photoObjectURL = URL.createObjectURL(file);
    const preview = document.getElementById("upload-preview");
    preview.src = photoObjectURL;
    preview.classList.add("visible");
    document.getElementById("drop-content").style.display = "none";
  }
  
  
})