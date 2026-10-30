// Cropping is transient. Only the prepared JPEG is uploaded, never the source file.
window.AvatarEditor=class{
  constructor(save){
    this.save=save;this.dialog=document.querySelector('#avatar-dialog');this.canvas=document.querySelector('#avatar-canvas');this.controls=['zoom','x','y'].map(key=>document.querySelector('#avatar-'+key));this.busy=false;this.sequence=0;
    $('#avatar-change').on('click',()=>$('#avatar-file').trigger('click'));
    $('#avatar-file').on('change',event=>this.open(event.target.files[0]));
    $('#avatar-remove').on('click',async()=>{if(!this.busy){this.busy=true;try{await this.save('remove_avatar');}finally{this.busy=false;}}});
    $('#avatar-reset').on('click',()=>this.reset());$('#avatar-cancel').on('click',()=>this.close());$('#avatar-save').on('click',()=>this.submit());
    this.controls.forEach(input=>input.addEventListener('input',()=>this.draw()));
    this.dialog.addEventListener('cancel',event=>{event.preventDefault();if(!this.busy)this.close();});
    this.dialog.addEventListener('close',()=>{if(!this.dialog.open&&this.sequence===this.closedSequence)$('#avatar-change').trigger('focus');});
    this.canvas.addEventListener('pointerdown',event=>{if(this.busy||!this.image)return;this.drag={x:event.clientX,y:event.clientY,width:this.canvas.getBoundingClientRect().width,px:Number(this.controls[1].value),py:Number(this.controls[2].value)};this.canvas.setPointerCapture(event.pointerId);});
    this.canvas.addEventListener('pointermove',event=>{if(!this.drag||this.busy)return;const scale=Math.max(512/this.image.naturalWidth,512/this.image.naturalHeight)*Number(this.controls[0].value);for(const [index,delta,dimension]of [[1,event.clientX-this.drag.x,this.image.naturalWidth],[2,event.clientY-this.drag.y,this.image.naturalHeight]]){const overflow=dimension*scale-512;if(overflow>0)this.controls[index].value=String(Math.max(0,Math.min(100,(index===1?this.drag.px:this.drag.py)-delta*512/this.drag.width/overflow*100)));}this.draw();});
    const end=()=>{this.drag=null;};this.canvas.addEventListener('pointerup',end);this.canvas.addEventListener('pointercancel',end);this.canvas.addEventListener('lostpointercapture',end);
  }
  close(){this.release();this.closedSequence=this.sequence;this.dialog.close();}
  release(){this.sequence++;if(this.url)URL.revokeObjectURL(this.url);this.url=null;this.image=null;this.drag=null;$('#avatar-file').val('');}
  async open(file){
    if(this.busy||!file)return;
    this.release();const sequence=this.sequence;
    const feedback=message=>$('#avatar-feedback').removeClass('success').attr('role','alert').text(message).prop('hidden',false).trigger('focus');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){feedback('Choose a JPEG, PNG or WebP picture no larger than 10 MB.');return;}
    this.url=URL.createObjectURL(file);const image=new Image();
    try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=this.url;});if(sequence!==this.sequence)return;
      if(image.naturalWidth*image.naturalHeight>64000000)throw new Error('Image is too large');
      this.image=image;$('#avatar-editor-status').text('');this.reset();this.dialog.showModal();document.querySelector('#avatar-zoom').focus();
    }catch{if(sequence===this.sequence){this.release();feedback('This image could not be prepared. Choose a smaller, valid picture.');}}
  }
  reset(){if(this.busy)return;this.controls[0].value='1';this.controls[1].value='50';this.controls[2].value='50';this.draw();}
  draw(){if(!this.image)return;const [zoom,x,y]=this.controls.map(input=>Number(input.value)),scale=Math.max(512/this.image.naturalWidth,512/this.image.naturalHeight)*zoom,w=this.image.naturalWidth*scale,h=this.image.naturalHeight*scale,context=this.canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,512,512);context.drawImage(this.image,-(w-512)*x/100,-(h-512)*y/100,w,h);}
  async submit(){
    if(this.busy||!this.image)return;
    this.busy=true;this.dialog.setAttribute('aria-busy','true');$('#avatar-dialog button,#avatar-dialog input').prop('disabled',true);$('#avatar-save').text('Saving…');$('#avatar-editor-status').text('Preparing picture…');
    try{let blob;for(const quality of [.85,.7,.5]){blob=await new Promise(resolve=>this.canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=250000)break;}if(!blob||blob.size>250000)throw new Error('Choose a less detailed picture.');
      $('#avatar-editor-status').text('Saving picture…');if(await this.save('update_avatar',blob))this.close();else $('#avatar-editor-status').text($('#avatar-feedback').text()||'The picture was not saved. Try again.').trigger('focus');
    }catch(error){$('#avatar-editor-status').text(error.message||'The picture could not be saved. Try again.').trigger('focus');}
    finally{this.busy=false;this.dialog.removeAttribute('aria-busy');$('#avatar-dialog button,#avatar-dialog input').prop('disabled',false);$('#avatar-save').text('Save picture');}
  }
};
