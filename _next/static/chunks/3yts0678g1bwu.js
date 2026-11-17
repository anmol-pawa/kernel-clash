(()=>{"use strict";(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,68750,e=>{var t=e.i(94359),r=e.i(31320);let i={};e.s(["f",0,function(e,n,a){let s=0x811c9dc5;for(let t=0;t<n;t++)s^=e[t].uid,s=Math.imul(s,0x1000193)>>>0;return i[s]||function(e,n,a,s){let o={},l=0;for(let t=0;t<s;t++){let i=t<n?e[t]:r.f.EMPTY.source;o[l++]=i.source,o[l++]=i.style}let u=new t.f(o);return i[a]=u,u}(e,n,s,a)}])},87323,18102,96108,28028,45284,e=>{var t,r=e.i(24314);class i{constructor(e){"number"==typeof e?this.rawBinaryData=new ArrayBuffer(e):e instanceof Uint8Array?this.rawBinaryData=e.buffer:this.rawBinaryData=e,this.uint32View=new Uint32Array(this.rawBinaryData),this.float32View=new Float32Array(this.rawBinaryData),this.size=this.rawBinaryData.byteLength}get int8View(){return this._int8View||(this._int8View=new Int8Array(this.rawBinaryData)),this._int8View}get uint8View(){return this._uint8View||(this._uint8View=new Uint8Array(this.rawBinaryData)),this._uint8View}get int16View(){return this._int16View||(this._int16View=new Int16Array(this.rawBinaryData)),this._int16View}get int32View(){return this._int32View||(this._int32View=new Int32Array(this.rawBinaryData)),this._int32View}get float64View(){return this._float64Array||(this._float64Array=new Float64Array(this.rawBinaryData)),this._float64Array}get bigUint64View(){return this._bigUint64Array||(this._bigUint64Array=new BigUint64Array(this.rawBinaryData)),this._bigUint64Array}view(e){return this[`${e}View`]}destroy(){this.rawBinaryData=null,this.uint32View=null,this.float32View=null,this.uint16View=null,this._int8View=null,this._uint8View=null,this._int16View=null,this._int32View=null,this._float64Array=null,this._bigUint64Array=null}static sizeOf(e){switch(e){case"int8":case"uint8":return 1;case"int16":case"uint16":return 2;case"int32":case"uint32":case"float32":return 4;default:throw Error(`${e} isn't a valid view type`)}}}var n=e.i(49864),a=e.i(48446);function s(e,t,r,i){if(r??(r=0),i??(i=Math.min(e.byteLength-r,t.byteLength)),7&r||7&i)if(3&r||3&i)new Uint8Array(t).set(new Uint8Array(e,r,i));else{let n=i/4;new Float32Array(t,0,n).set(new Float32Array(e,r,n))}else{let n=i/8;new Float64Array(t,0,n).set(new Float64Array(e,r,n))}}e.s(["f",0,s],18102);let o={normal:"normal-npm",add:"add-npm",screen:"screen-npm"};var l=((t=l||{})[t.DISABLED=0]="DISABLED",t[t.RENDERING_MASK_ADD=1]="RENDERING_MASK_ADD",t[t.MASK_ACTIVE=2]="MASK_ACTIVE",t[t.INVERSE_MASK_ACTIVE=3]="INVERSE_MASK_ACTIVE",t[t.RENDERING_MASK_REMOVE=4]="RENDERING_MASK_REMOVE",t[t.NONE=5]="NONE",t);function u(e,t){return"no-premultiply-alpha"===t.alphaMode&&o[e]||e}e.s(["q",0,o,"U",0,l],96108);var h=e.i(29281);function d(e,t){if(0===e)throw Error("Invalid value of `0` passed to `checkMaxIfStatementsInShader`");let r=t.createShader(t.FRAGMENT_SHADER);try{for(;;){let i="precision mediump float;\nvoid main(void){\nfloat test = 0.1;\n%forloop%\ngl_FragColor = vec4(0.0);\n}".replace(/%forloop%/gi,function(e){let t="";for(let r=0;r<e;++r)r>0&&(t+="\nelse "),r<e-1&&(t+=`if(test == ${r}.0){}`);return t}(e));if(t.shaderSource(r,i),t.compileShader(r),t.getShaderParameter(r,t.COMPILE_STATUS))break;e=e/2|0}}finally{t.deleteShader(r)}return e}e.s(["f",0,d],28028);let c=null;class f{constructor(){this.ids=Object.create(null),this.textures=[],this.count=0}clear(){for(let e=0;e<this.count;e++){let t=this.textures[e];this.textures[e]=null,this.ids[t.uid]=null}this.count=0}}class m{constructor(){this.renderPipeId="batch",this.action="startBatch",this.start=0,this.size=0,this.textures=new f,this.blendMode="normal",this.topology="triangle-strip",this.canBundle=!0}destroy(){this.textures=null,this.gpuBindGroup=null,this.bindGroup=null,this.batcher=null,this.elements=null}}let x=[],p=0;function g(){return p>0?x[--p]:new m}function v(e){e.elements=null,x[p++]=e}a.f.register({clear:()=>{if(x.length>0)for(let e of x)e&&e.destroy();x.length=0,p=0}});let b=0,_=class e{constructor(t){this.uid=(0,r.f)("batcher"),this.dirty=!0,this.batchIndex=0,this.batches=[],this._elements=[],(t={...e.defaultOptions,...t}).maxTextures||((0,n.K)("v8.8.0","maxTextures is a required option for Batcher now, please pass it in the options"),t.maxTextures=function(){if(c)return c;let e=(0,h.f)();return c=d(c=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),e),e.getExtension("WEBGL_lose_context")?.loseContext(),c}());let{maxTextures:a,attributesInitialSize:s,indicesInitialSize:o}=t;this.attributeBuffer=new i(4*s),this.indexBuffer=new Uint16Array(o),this.maxTextures=a}begin(){this.elementSize=0,this.elementStart=0,this.indexSize=0,this.attributeSize=0;for(let e=0;e<this.batchIndex;e++)v(this.batches[e]);this.batchIndex=0,this._batchIndexStart=0,this._batchIndexSize=0,this.dirty=!0}add(e){this._elements[this.elementSize++]=e,e._indexStart=this.indexSize,e._attributeStart=this.attributeSize,e._batcher=this,this.indexSize+=e.indexSize,this.attributeSize+=e.attributeSize*this.vertexSize}checkAndUpdateTexture(e,t){let r=e._batch.textures.ids[t._source.uid];return(!!r||0===r)&&(e._textureId=r,e.texture=t,!0)}updateElement(e){this.dirty=!0;let t=this.attributeBuffer;e.packAsQuad?this.packQuadAttributes(e,t.float32View,t.uint32View,e._attributeStart,e._textureId):this.packAttributes(e,t.float32View,t.uint32View,e._attributeStart,e._textureId)}break(e){let t=this._elements;if(!t[this.elementStart])return;let r=g(),i=r.textures;i.clear();let n=t[this.elementStart],a=u(n.blendMode,n.texture._source),s=n.topology;4*this.attributeSize>this.attributeBuffer.size&&this._resizeAttributeBuffer(4*this.attributeSize),this.indexSize>this.indexBuffer.length&&this._resizeIndexBuffer(this.indexSize);let o=this.attributeBuffer.float32View,l=this.attributeBuffer.uint32View,h=this.indexBuffer,d=this._batchIndexSize,c=this._batchIndexStart,f="startBatch",m=[],x=this.maxTextures;for(let n=this.elementStart;n<this.elementSize;++n){let p=t[n];t[n]=null;let v=p.texture._source,_=u(p.blendMode,v),y=a!==_||s!==p.topology;if(v._batchTick===b&&!y){p._textureId=v._textureBindLocation,d+=p.indexSize,p.packAsQuad?(this.packQuadAttributes(p,o,l,p._attributeStart,p._textureId),this.packQuadIndex(h,p._indexStart,p._attributeStart/this.vertexSize)):(this.packAttributes(p,o,l,p._attributeStart,p._textureId),this.packIndex(p,h,p._indexStart,p._attributeStart/this.vertexSize)),p._batch=r,m.push(p);continue}v._batchTick=b,(i.count>=x||y)&&(this._finishBatch(r,c,d-c,i,a,s,e,f,m),f="renderBatch",c=d,a=_,s=p.topology,(i=(r=g()).textures).clear(),m=[],++b),p._textureId=v._textureBindLocation=i.count,i.ids[v.uid]=i.count,i.textures[i.count++]=v,p._batch=r,m.push(p),d+=p.indexSize,p.packAsQuad?(this.packQuadAttributes(p,o,l,p._attributeStart,p._textureId),this.packQuadIndex(h,p._indexStart,p._attributeStart/this.vertexSize)):(this.packAttributes(p,o,l,p._attributeStart,p._textureId),this.packIndex(p,h,p._indexStart,p._attributeStart/this.vertexSize))}i.count>0&&(this._finishBatch(r,c,d-c,i,a,s,e,f,m),c=d,++b),this.elementStart=this.elementSize,this._batchIndexStart=c,this._batchIndexSize=d}_finishBatch(e,t,r,i,n,a,s,o,l){e.gpuBindGroup=null,e.bindGroup=null,e.action=o,e.batcher=this,e.textures=i,e.blendMode=n,e.topology=a,e.start=t,e.size=r,e.elements=l,++b,this.batches[this.batchIndex++]=e,s.add(e)}finish(e){this.break(e)}ensureAttributeBuffer(e){4*e<=this.attributeBuffer.size||this._resizeAttributeBuffer(4*e)}ensureIndexBuffer(e){e<=this.indexBuffer.length||this._resizeIndexBuffer(e)}_resizeAttributeBuffer(e){let t=new i(Math.max(e,2*this.attributeBuffer.size));s(this.attributeBuffer.rawBinaryData,t.rawBinaryData),this.attributeBuffer=t}_resizeIndexBuffer(e){let t=this.indexBuffer,r=Math.max(e,1.5*t.length);r+=r%2;let i=r>65535?new Uint32Array(r):new Uint16Array(r);if(i.BYTES_PER_ELEMENT!==t.BYTES_PER_ELEMENT)for(let e=0;e<t.length;e++)i[e]=t[e];else s(t.buffer,i.buffer);this.indexBuffer=i}packQuadIndex(e,t,r){e[t]=r+0,e[t+1]=r+1,e[t+2]=r+2,e[t+3]=r+0,e[t+4]=r+2,e[t+5]=r+3}packIndex(e,t,r,i){let n=e.indices,a=e.indexSize,s=e.indexOffset,o=e.attributeOffset;for(let e=0;e<a;e++)t[r++]=i+n[e+s]-o}destroy(e={}){if(null!==this.batches){for(let e=0;e<this.batchIndex;e++)v(this.batches[e]);this.batches=null,this.geometry.destroy(!0),this.geometry=null,e.shader&&(this.shader?.destroy(),this.shader=null);for(let e=0;e<this._elements.length;e++)this._elements[e]&&(this._elements[e]._batch=null);this._elements=null,this.indexBuffer=null,this.attributeBuffer.destroy(),this.attributeBuffer=null}}};_.defaultOptions={maxTextures:null,attributesInitialSize:4,indicesInitialSize:6},e.s(["f",0,_],87323);var y=e.i(85465),w=e.i(64957),S=e.i(60406);let I=new Float32Array(1),C=new Uint32Array(1);class T extends S.f{constructor(){let e=new y.f({data:I,label:"attribute-batch-buffer",usage:w.f.VERTEX|w.f.COPY_DST,shrinkToFit:!1});super({attributes:{aPosition:{buffer:e,format:"float32x2",stride:24,offset:0},aUV:{buffer:e,format:"float32x2",stride:24,offset:8},aColor:{buffer:e,format:"unorm8x4",stride:24,offset:16},aTextureIdAndRound:{buffer:e,format:"uint16x2",stride:24,offset:20}},indexBuffer:new y.f({data:C,label:"index-batch-buffer",usage:w.f.INDEX|w.f.COPY_DST,shrinkToFit:!1})})}}e.s(["f",0,T],45284)},97828,e=>{var t=e.i(47760),r=e.i(87323),i=e.i(45284),n=e.i(81491),a=e.i(68372),s=e.i(94111),o=e.i(55443),l=e.i(77953),u=e.i(65654);class h extends u.f{constructor(e){super({glProgram:(0,n.L)({name:"batch",bits:[a.z,(0,s.k)(e),o.a]}),gpuProgram:(0,n.M)({name:"batch",bits:[a.O,(0,s.u)(e),o.Z]}),resources:{batchSamplers:(0,l.f)(e)}}),this.maxTextures=e}}let d=null,c=class e extends r.f{constructor(t){super(t),this.geometry=new i.f,this.name=e.extension.name,this.vertexSize=6,d??(d=new h(t.maxTextures)),this.shader=d}packAttributes(e,t,r,i,n){let a=n<<16|65535&e.roundPixels,s=e.transform,o=s.a,l=s.b,u=s.c,h=s.d,d=s.tx,c=s.ty,{positions:f,uvs:m}=e,x=e.color,p=e.attributeOffset,g=p+e.attributeSize;for(let e=p;e<g;e++){let n=2*e,s=f[n],p=f[n+1];t[i++]=o*s+u*p+d,t[i++]=h*p+l*s+c,t[i++]=m[n],t[i++]=m[n+1],r[i++]=x,r[i++]=a}}packQuadAttributes(e,t,r,i,n){let a=e.texture,s=e.transform,o=s.a,l=s.b,u=s.c,h=s.d,d=s.tx,c=s.ty,f=e.bounds,m=f.maxX,x=f.minX,p=f.maxY,g=f.minY,v=a.uvs,b=e.color,_=n<<16|65535&e.roundPixels;t[i+0]=o*x+u*g+d,t[i+1]=h*g+l*x+c,t[i+2]=v.x0,t[i+3]=v.y0,r[i+4]=b,r[i+5]=_,t[i+6]=o*m+u*g+d,t[i+7]=h*g+l*m+c,t[i+8]=v.x1,t[i+9]=v.y1,r[i+10]=b,r[i+11]=_,t[i+12]=o*m+u*p+d,t[i+13]=h*p+l*m+c,t[i+14]=v.x2,t[i+15]=v.y2,r[i+16]=b,r[i+17]=_,t[i+18]=o*x+u*p+d,t[i+19]=h*p+l*x+c,t[i+20]=v.x3,t[i+21]=v.y3,r[i+22]=b,r[i+23]=_}_updateMaxTextures(e){this.shader.maxTextures!==e&&(d=new h(e),this.shader=d)}destroy(){this.shader=null,super.destroy()}};c.extension={type:[t.x.Batcher],name:"default"},e.s(["f",0,c],97828)},81491,68372,94111,55443,e=>{var t=e.i(81107),r=e.i(27076),i=e.i(85830);function n(e,t,r){if(e)for(let n in e){let a=t[n.toLocaleLowerCase()];if(a){let t=e[n];"header"===n&&(t=t.replace(/@in\s+[^;]+;\s*/g,"").replace(/@out\s+[^;]+;\s*/g,"")),r&&a.push(`//----${r}----//`),a.push(t)}else(0,i.f)(`${n} placement hook does not exist in shader`)}}let a=/\{\{(.*?)\}\}/g;function s(e){let t={};return(e.match(a)?.map(e=>e.replace(/[{()}]/g,""))??[]).forEach(e=>{t[e]=[]}),t}function o(e,t){let r,i=/@in\s+([^;]+);/g;for(;null!==(r=i.exec(e));)t.push(r[1])}function l(e,t,r=!1){let i=[];o(t,i),e.forEach(e=>{e.header&&o(e.header,i)}),r&&i.sort();let n=i.map((e,t)=>`       @location(${t}) ${e},`).join("\n"),a=t.replace(/@in\s+[^;]+;\s*/g,"");return a.replace("{{in}}",`
${n}
`)}function u(e,t){let r,i=/@out\s+([^;]+);/g;for(;null!==(r=i.exec(e));)t.push(r[1])}function h(e,t){let r=e;for(let e in t){let i=t[e];r=i.join("\n").length?r.replace(`{{${e}}}`,`//-----${e} START-----//
${i.join("\n")}
//----${e} FINISH----//`):r.replace(`{{${e}}}`,"")}return r}let d=Object.create(null),c=new Map,f=0;function m(e,t){return t.map(e=>(c.has(e)||c.set(e,f++),c.get(e))).sort((e,t)=>e-t).join("-")+e.vertex+e.fragment}function x(e,t,r){let i=s(e),a=s(t);return r.forEach(e=>{n(e.vertex,i,e.name),n(e.fragment,a,e.name)}),{vertex:h(e,i),fragment:h(t,a)}}let p=`
    @in aPosition: vec2<f32>;
    @in aUV: vec2<f32>;

    @out @builtin(position) vPosition: vec4<f32>;
    @out vUV : vec2<f32>;
    @out vColor : vec4<f32>;

    {{header}}

    struct VSOutput {
        {{struct}}
    };

    @vertex
    fn main( {{in}} ) -> VSOutput {

        var worldTransformMatrix = globalUniforms.uWorldTransformMatrix;
        var modelMatrix = mat3x3<f32>(
            1.0, 0.0, 0.0,
            0.0, 1.0, 0.0,
            0.0, 0.0, 1.0
          );
        var position = aPosition;
        var uv = aUV;

        {{start}}

        vColor = vec4<f32>(1., 1., 1., 1.);

        {{main}}

        vUV = uv;

        var modelViewProjectionMatrix = globalUniforms.uProjectionMatrix * worldTransformMatrix * modelMatrix;

        vPosition =  vec4<f32>((modelViewProjectionMatrix *  vec3<f32>(position, 1.0)).xy, 0.0, 1.0);

        vColor *= globalUniforms.uWorldColorAlpha;

        {{end}}

        {{return}}
    };
`,g=`
    @in vUV : vec2<f32>;
    @in vColor : vec4<f32>;

    {{header}}

    @fragment
    fn main(
        {{in}}
      ) -> @location(0) vec4<f32> {

        {{start}}

        var outColor:vec4<f32>;

        {{main}}

        var finalColor:vec4<f32> = outColor * vColor;

        {{end}}

        return finalColor;
      };
`,v=`
    in vec2 aPosition;
    in vec2 aUV;

    out vec4 vColor;
    out vec2 vUV;

    {{header}}

    void main(void){

        mat3 worldTransformMatrix = uWorldTransformMatrix;
        mat3 modelMatrix = mat3(
            1.0, 0.0, 0.0,
            0.0, 1.0, 0.0,
            0.0, 0.0, 1.0
          );
        vec2 position = aPosition;
        vec2 uv = aUV;

        {{start}}

        vColor = vec4(1.);

        {{main}}

        vUV = uv;

        mat3 modelViewProjectionMatrix = uProjectionMatrix * worldTransformMatrix * modelMatrix;

        gl_Position = vec4((modelViewProjectionMatrix * vec3(position, 1.0)).xy, 0.0, 1.0);

        vColor *= uWorldColorAlpha;

        {{end}}
    }
`,b=`

    in vec4 vColor;
    in vec2 vUV;

    out vec4 finalColor;

    {{header}}

    void main(void) {

        {{start}}

        vec4 outColor;

        {{main}}

        finalColor = outColor * vColor;

        {{end}}
    }
`,_={name:"global-uniforms-bit",vertex:{header:`
        struct GlobalUniforms {
            uProjectionMatrix:mat3x3<f32>,
            uWorldTransformMatrix:mat3x3<f32>,
            uWorldColorAlpha: vec4<f32>,
            uResolution: vec2<f32>,
        }

        @group(0) @binding(0) var<uniform> globalUniforms : GlobalUniforms;
        `}},y={name:"global-uniforms-bit",vertex:{header:`
          uniform mat3 uProjectionMatrix;
          uniform mat3 uWorldTransformMatrix;
          uniform vec4 uWorldColorAlpha;
          uniform vec2 uResolution;
        `}};e.s(["L",0,function({bits:e,name:r}){return new t.f({name:r,...function({template:e,bits:t}){let r=m(e,t);return d[r]||(d[r]=x(e.vertex,e.fragment,t)),d[r]}({template:{vertex:v,fragment:b},bits:[y,...e]})})},"M",0,function({bits:e,name:t}){let i=function({template:e,bits:t}){let r=m(e,t);if(d[r])return d[r];let{vertex:i,fragment:n}=function(e,t){var r;let i,n,a,s,o,h=t.map(e=>e.vertex).filter(e=>!!e),d=t.map(e=>e.fragment).filter(e=>!!e),c=l(h,e.vertex,!0);return i=[],u(r=c,i),h.forEach(e=>{e.header&&u(e.header,i)}),n=0,a=i.sort().map(e=>e.indexOf("builtin")>-1?e:`@location(${n++}) ${e}`).join(",\n"),s=i.sort().map(e=>`       var ${e.replace(/@.*?\s+/g,"")};`).join("\n"),o=`return VSOutput(
            ${i.sort().map(e=>{let t;return` ${(t=/\b(\w+)\s*:/g.exec(e))?t[1]:""}`}).join(",\n")});`,{vertex:c=r.replace(/@out\s+[^;]+;\s*/g,"").replace("{{struct}}",`
${a}
`).replace("{{start}}",`
${s}
`).replace("{{return}}",`
${o}
`),fragment:l(d,e.fragment,!0)}}(e,t);return d[r]=x(i,n,t),d[r]}({template:{fragment:g,vertex:p},bits:[_,...e]});return r.f.from({name:t,vertex:{source:i.vertex,entryPoint:"main"},fragment:{source:i.fragment,entryPoint:"main"}})}],81491);let w={name:"color-bit",vertex:{header:`
            @in aColor: vec4<f32>;
        `,main:`
            vColor *= vec4<f32>(aColor.rgb * aColor.a, aColor.a);
        `}},S={name:"color-bit",vertex:{header:`
            in vec4 aColor;
        `,main:`
            vColor *= vec4(aColor.rgb * aColor.a, aColor.a);
        `}};e.s(["O",0,w,"z",0,S],68372);let I={},C={};e.s(["u",0,function(e){return I[e]||(I[e]={name:"texture-batch-bit",vertex:{header:`
                @in aTextureIdAndRound: vec2<u32>;
                @out @interpolate(flat) vTextureId : u32;
            `,main:`
                vTextureId = aTextureIdAndRound.y;
            `,end:`
                if(aTextureIdAndRound.x == 1)
                {
                    vPosition = vec4<f32>(roundPixels(vPosition.xy, globalUniforms.uResolution), vPosition.zw);
                }
            `},fragment:{header:`
                @in @interpolate(flat) vTextureId: u32;

                ${function(e){let t=[];if(1===e)t.push("@group(1) @binding(0) var textureSource1: texture_2d<f32>;"),t.push("@group(1) @binding(1) var textureSampler1: sampler;");else{let r=0;for(let i=0;i<e;i++)t.push(`@group(1) @binding(${r++}) var textureSource${i+1}: texture_2d<f32>;`),t.push(`@group(1) @binding(${r++}) var textureSampler${i+1}: sampler;`)}return t.join("\n")}(e)}
            `,main:`
                var uvDx = dpdx(vUV);
                var uvDy = dpdy(vUV);

                ${function(e){let t=[];if(1===e)t.push("outColor = textureSampleGrad(textureSource1, textureSampler1, vUV, uvDx, uvDy);");else{t.push("switch vTextureId {");for(let r=0;r<e;r++)r===e-1?t.push("  default:{"):t.push(`  case ${r}:{`),t.push(`      outColor = textureSampleGrad(textureSource${r+1}, textureSampler${r+1}, vUV, uvDx, uvDy);`),t.push("      break;}");t.push("}")}return t.join("\n")}(e)}
            `}}),I[e]},"k",0,function(e){return C[e]||(C[e]={name:"texture-batch-bit",vertex:{header:`
                in vec2 aTextureIdAndRound;
                out float vTextureId;

            `,main:`
                vTextureId = aTextureIdAndRound.y;
            `,end:`
                if(aTextureIdAndRound.x == 1.)
                {
                    gl_Position.xy = roundPixels(gl_Position.xy, uResolution);
                }
            `},fragment:{header:`
                in float vTextureId;

                uniform sampler2D uTextures[${e}];

            `,main:`

                ${function(e){let t=[];for(let r=0;r<e;r++)r>0&&t.push("else"),r<e-1&&t.push(`if(vTextureId < ${r}.5)`),t.push("{"),t.push(`	outColor = texture(uTextures[${r}], vUV);`),t.push("}");return t.join("\n")}(e)}
            `}}),C[e]}],94111);let T={name:"round-pixels-bit",vertex:{header:`
            fn roundPixels(position: vec2<f32>, targetSize: vec2<f32>) -> vec2<f32>
            {
                return (floor(((position * 0.5 + 0.5) * targetSize) + 0.5) / targetSize) * 2.0 - 1.0;
            }
        `}},A={name:"round-pixels-bit",vertex:{header:`
            vec2 roundPixels(vec2 position, vec2 targetSize)
            {
                return (floor(((position * 0.5 + 0.5) * targetSize) + 0.5) / targetSize) * 2.0 - 1.0;
            }
        `}};e.s(["Z",0,T,"a",0,A],55443)},61805,77718,e=>{let t;var r=e.i(57471),i=e.i(27402),n=e.i(56881);function a(e){let t=i.f.get().createCanvas(6,1),r=t.getContext("2d");return r.fillStyle=e,r.fillRect(0,0,6,1),t}function s(){if(void 0!==t)return t;try{let e=a("#ff00ff"),r=a("#ffff00"),n=i.f.get().createCanvas(6,1).getContext("2d");n.globalCompositeOperation="multiply",n.drawImage(e,0,0),n.drawImage(r,2,0);let s=n.getImageData(2,0,1,1);if(s){let e=s.data;t=255===e[0]&&0===e[1]&&0===e[2]}else t=!1}catch(e){t=!1}return t}e.s(["f",0,s],77718);let o={canvas:null,convertTintToImage:!1,cacheStepsPerColorChannel:8,canUseMultiply:s(),tintMethod:null,_canvasSourceCache:new WeakMap,_unpremultipliedCache:new WeakMap,getCanvasSource:e=>{let t=e.source,r=t?.resource;if(!r)return null;let n="premultiplied-alpha"===t.alphaMode,a=t.resourceWidth??t.pixelWidth,s=t.resourceHeight??t.pixelHeight,l=a!==t.pixelWidth||s!==t.pixelHeight;if(n){if((r instanceof HTMLCanvasElement||"u">typeof OffscreenCanvas&&r instanceof OffscreenCanvas)&&!l)return r;let e=o._unpremultipliedCache.get(t);if(e?.resourceId===t._resourceId)return e.canvas}if(r instanceof Uint8Array||r instanceof Uint8ClampedArray||r instanceof Int8Array||r instanceof Uint16Array||r instanceof Int16Array||r instanceof Uint32Array||r instanceof Int32Array||r instanceof Float32Array||r instanceof ArrayBuffer){let e=o._canvasSourceCache.get(t);if(e?.resourceId===t._resourceId)return e.canvas;let n=i.f.get().createCanvas(t.pixelWidth,t.pixelHeight),a=n.getContext("2d"),s=a.createImageData(t.pixelWidth,t.pixelHeight),l=s.data,u=r instanceof ArrayBuffer?new Uint8Array(r):new Uint8Array(r.buffer,r.byteOffset,r.byteLength);if("bgra8unorm"===t.format)for(let e=0;e<l.length&&e+3<u.length;e+=4)l[e]=u[e+2],l[e+1]=u[e+1],l[e+2]=u[e],l[e+3]=u[e+3];else l.set(u.subarray(0,l.length));return a.putImageData(s,0,0),o._canvasSourceCache.set(t,{canvas:n,resourceId:t._resourceId}),n}if(n){let e=i.f.get().createCanvas(t.pixelWidth,t.pixelHeight),n=e.getContext("2d",{willReadFrequently:!0});e.width=t.pixelWidth,e.height=t.pixelHeight,n.drawImage(r,0,0);let a=n.getImageData(0,0,e.width,e.height),s=a.data;for(let e=0;e<s.length;e+=4){let t=s[e+3];if(t>0){let r=255/t;s[e]=Math.min(255,s[e]*r+.5),s[e+1]=Math.min(255,s[e+1]*r+.5),s[e+2]=Math.min(255,s[e+2]*r+.5)}}return n.putImageData(a,0,0),o._unpremultipliedCache.set(t,{canvas:e,resourceId:t._resourceId}),e}if(l){let e=o._canvasSourceCache.get(t);if(e?.resourceId===t._resourceId)return e.canvas;let n=i.f.get().createCanvas(t.pixelWidth,t.pixelHeight),a=n.getContext("2d");return n.width=t.pixelWidth,n.height=t.pixelHeight,a.drawImage(r,0,0),o._canvasSourceCache.set(t,{canvas:n,resourceId:t._resourceId}),n}return r},getTintedCanvas:(e,t)=>{let n=e.texture,a=r.f.shared.setValue(t).toHex(),s=n.tintCache||(n.tintCache={}),l=s[a],u=n.source._resourceId;if(l?.tintId===u)return l;let h=l&&"getContext"in l?l:i.f.get().createCanvas();if(o.tintMethod(n,t,h),h.tintId=u,o.convertTintToImage&&void 0!==h.toDataURL){let e=i.f.get().createImage();e.src=h.toDataURL(),e.tintId=u,s[a]=e}else s[a]=h;return s[a]},getTintedPattern:(e,t)=>{let n=r.f.shared.setValue(t).toHex(),a=e.patternCache||(e.patternCache={}),s=e.source._resourceId,l=a[n];return l?.tintId===s||(o.canvas||(o.canvas=i.f.get().createCanvas()),o.tintMethod(e,t,o.canvas),(l=o.canvas.getContext("2d").createPattern(o.canvas,"repeat")).tintId=s,a[n]=l),l},applyPatternTransform:(e,t,r=!0)=>{if(!t||!e.setTransform)return;let i=globalThis.DOMMatrix;if(!i)return;let n=new i([t.a,t.b,t.c,t.d,t.tx,t.ty]);e.setTransform(r?n.inverse():n)},tintWithMultiply:(e,t,i)=>{let a=i.getContext("2d"),s=e.frame.clone(),l=e.source._resolution??e.source.resolution??1,u=e.rotate;s.x*=l,s.y*=l,s.width*=l,s.height*=l;let h=n.f.isVertical(u),d=h?s.height:s.width,c=h?s.width:s.height;i.width=Math.ceil(d),i.height=Math.ceil(c),a.save(),0xffffff!==t&&(a.fillStyle=r.f.shared.setValue(t).toHex(),a.fillRect(0,0,d,c),a.globalCompositeOperation="multiply");let f=o.getCanvasSource(e);f&&(u&&o._applyInverseRotation(a,u,s.width,s.height),a.drawImage(f,s.x,s.y,s.width,s.height,0,0,s.width,s.height),0xffffff!==t&&(a.globalCompositeOperation="destination-atop",a.drawImage(f,s.x,s.y,s.width,s.height,0,0,s.width,s.height))),a.restore()},tintWithOverlay:(e,t,i)=>{let a=i.getContext("2d"),s=e.frame.clone(),l=e.source._resolution??e.source.resolution??1,u=e.rotate;s.x*=l,s.y*=l,s.width*=l,s.height*=l;let h=n.f.isVertical(u),d=h?s.height:s.width,c=h?s.width:s.height;i.width=Math.ceil(d),i.height=Math.ceil(c),a.save(),a.globalCompositeOperation="copy",a.fillStyle=r.f.shared.setValue(t).toHex(),a.fillRect(0,0,d,c),a.globalCompositeOperation="destination-atop";let f=o.getCanvasSource(e);f&&(u&&o._applyInverseRotation(a,u,s.width,s.height),a.drawImage(f,s.x,s.y,s.width,s.height,0,0,s.width,s.height)),a.restore()},tintWithPerPixel:(e,t,r)=>{let i=r.getContext("2d"),a=e.frame.clone(),s=e.source._resolution??e.source.resolution??1,l=e.rotate;a.x*=s,a.y*=s,a.width*=s,a.height*=s;let u=n.f.isVertical(l),h=u?a.height:a.width,d=u?a.width:a.height;r.width=Math.ceil(h),r.height=Math.ceil(d),i.save(),i.globalCompositeOperation="copy";let c=o.getCanvasSource(e);if(!c)return void i.restore();l&&o._applyInverseRotation(i,l,a.width,a.height),i.drawImage(c,a.x,a.y,a.width,a.height,0,0,a.width,a.height),i.restore();let f=t>>16&255,m=t>>8&255,x=255&t,p=i.getImageData(0,0,h,d),g=p.data;for(let e=0;e<g.length;e+=4)g[e]=g[e]*f/255,g[e+1]=g[e+1]*m/255,g[e+2]=g[e+2]*x/255;i.putImageData(p,0,0)},_applyInverseRotation:(e,t,r,i)=>{let a=n.f.inv(t),s=n.f.uX(a),o=n.f.uY(a),l=n.f.vX(a),u=n.f.vY(a),h=-Math.min(0,s*r,l*i,s*r+l*i),d=-Math.min(0,o*r,u*i,o*r+u*i);e.transform(s,o,l,u,h,d)}};o.tintMethod=o.canUseMultiply?o.tintWithMultiply:o.tintWithPerPixel,e.s(["f",0,o],61805)},77953,e=>{var t=e.i(32543);let r={};e.s(["f",0,function(e){let i=r[e];if(i)return i;let n=new Int32Array(e);for(let t=0;t<e;t++)n[t]=t;return r[e]=new t.f({uTextures:{value:n,type:"i32",size:e}},{isStatic:!0})}])},2351,55364,69510,3197,e=>{let t;var r,i=e.i(57471),n=e.i(47760);let a=[];async function s(e){if(!e)for(let e=0;e<a.length;e++){let t=a[e];if(t.value.test())return void await t.value.load()}}n.H.handleByNamedList(n.x.Environment,a);var o=e.i(50147);function l(){if("boolean"==typeof t)return t;try{let e=Function("param1","param2","param3","return param1[param2] === param3;");t=!0===e({a:"b"},"a","b")}catch(e){t=!1}return t}e.s(["f",0,l],55364);var u=e.i(24314),h=e.i(49864),d=e.i(48446),c=((r=c||{})[r.NONE=0]="NONE",r[r.COLOR=16384]="COLOR",r[r.STENCIL=1024]="STENCIL",r[r.DEPTH=256]="DEPTH",r[r.COLOR_DEPTH=16640]="COLOR_DEPTH",r[r.COLOR_STENCIL=17408]="COLOR_STENCIL",r[r.DEPTH_STENCIL=1280]="DEPTH_STENCIL",r[r.ALL=17664]="ALL",r);e.s(["f",0,c],69510);class f{constructor(e){this.items=[],this._name=e}emit(e,t,r,i,n,a,s,o){let{name:l,items:u}=this;for(let h=0,d=u.length;h<d;h++)u[h][l](e,t,r,i,n,a,s,o);return this}add(e){return e[this._name]&&(this.remove(e),this.items.push(e)),this}remove(e){let t=this.items.indexOf(e);return -1!==t&&this.items.splice(t,1),this}contains(e){return -1!==this.items.indexOf(e)}removeAll(){return this.items.length=0,this}destroy(){this.removeAll(),this.items=null,this._name=null}get empty(){return 0===this.items.length}get name(){return this._name}}e.s(["f",0,f],3197);var m=e.i(95932);let x=["init","destroy","contextChange","resolutionChange","resetState","renderEnd","renderStart","render","update","postrender","prerender"],p=class e extends m.f{constructor(e){super(),this.tick=0,this.uid=(0,u.f)("renderer"),this.runners=Object.create(null),this.renderPipes=Object.create(null),this._initOptions={},this._systemsHash=Object.create(null),this.type=e.type,this.name=e.name,this.config=e;let t=[...x,...this.config.runners??[]];this._addRunners(...t),this._unsafeEvalCheck()}async init(t={}){let r=!0===t.skipExtensionImports||!1===t.manageImports;for(let e in await s(r),!r&&this.config.loaders&&await Promise.all(this.config.loaders.map(e=>e.value.load())),this._addSystems(this.config.systems),this._addPipes(this.config.renderPipes,this.config.renderPipeAdaptors),this._systemsHash)t={...this._systemsHash[e].constructor.defaultOptions,...t};t={...e.defaultOptions,...t},this._roundPixels=+!!t.roundPixels;for(let e=0;e<this.runners.init.items.length;e++)await this.runners.init.items[e].init(t);this._initOptions=t}render(e,t){this.tick++;let r=e;if(r instanceof o.t&&(r={container:r},t&&((0,h.K)(h.e,"passing a second argument is deprecated, please use render options instead"),r.target=t.renderTexture)),r.target||(r.target=this.view.renderTarget),r.target===this.view.renderTarget&&(this._lastObjectRendered=r.container,r.clearColor??(r.clearColor=this.background.colorRgba),r.clear??(r.clear=this.background.clearBeforeRender)),r.clearColor){let e=Array.isArray(r.clearColor)&&4===r.clearColor.length;r.clearColor=e?r.clearColor:i.f.shared.setValue(r.clearColor).toArray()}r.transform||(r.container.updateLocalTransform(),r.transform=r.container.localTransform),r.container.visible&&(r.container.enableRenderGroup(),this.runners.prerender.emit(r),this.runners.renderStart.emit(r),this.runners.render.emit(r),this.runners.renderEnd.emit(r),this.runners.postrender.emit(r))}resize(e,t,r){let i=this.view.resolution;this.view.resize(e,t,r),this.emit("resize",this.view.screen.width,this.view.screen.height,this.view.resolution),void 0!==r&&r!==i&&this.runners.resolutionChange.emit(r)}clear(e={}){e.target||(e.target=this.renderTarget.renderTarget),e.clearColor||(e.clearColor=this.background.colorRgba),e.clear??(e.clear=c.ALL);let{clear:t,clearColor:r,target:n,mipLevel:a,layer:s}=e;i.f.shared.setValue(r??this.background.colorRgba),this.renderTarget.clear(n,t,i.f.shared.toArray(),a??0,s??0)}get resolution(){return this.view.resolution}set resolution(e){this.view.resolution=e,this.runners.resolutionChange.emit(e)}get width(){return this.view.texture.frame.width}get height(){return this.view.texture.frame.height}get canvas(){return this.view.canvas}get lastObjectRendered(){return this._lastObjectRendered}get renderingToScreen(){return this.renderTarget.renderingToScreen}get screen(){return this.view.screen}_addRunners(...e){e.forEach(e=>{this.runners[e]=new f(e)})}_addSystems(e){let t;for(t in e){let r=e[t];this._addSystem(r.value,r.name)}}_addSystem(e,t){let r=new e(this);if(this[t])throw Error(`Whoops! The name "${t}" is already in use`);for(let e in this[t]=r,this._systemsHash[t]=r,this.runners)this.runners[e].add(r);return this}_addPipes(e,t){let r=t.reduce((e,t)=>(e[t.name]=t.value,e),{});e.forEach(e=>{let t=e.value,i=e.name,n=r[i];this.renderPipes[i]=new t(this,n?new n:null),this.runners.destroy.add(this.renderPipes[i])})}destroy(e=!1){this.runners.destroy.items.reverse(),this.runners.destroy.emit(e),(!0===e||"object"==typeof e&&e.releaseGlobalResources)&&d.f.release(),Object.values(this.runners).forEach(e=>{e.destroy()}),this._systemsHash=null,this.renderPipes=null,this.removeAllListeners()}generateTexture(e){return this.textureGenerator.generateTexture(e)}get roundPixels(){return!!this._roundPixels}_unsafeEvalCheck(){if(!l())throw Error("Current environment does not allow unsafe-eval, please use pixi.js/unsafe-eval module to enable support.")}resetState(){this.runners.resetState.emit()}};p.defaultOptions={resolution:1,failIfMajorPerformanceCaveat:!1,roundPixels:!1},e.s(["f",0,p],2351)},16203,e=>{var t=e.i(47760),r=e.i(95627);class i extends r.f{constructor(e){super(e),this.uploadMethodId="image",this.autoGarbageCollect=!0}static test(e){return globalThis.HTMLImageElement&&e instanceof HTMLImageElement||"u">typeof ImageBitmap&&e instanceof ImageBitmap||globalThis.VideoFrame&&e instanceof VideoFrame}}i.extension=t.x.TextureSource,e.s(["f",0,i])},89506,e=>{e.s(["f",0,function(e,t,r){let i=(e>>24&255)/255;t[r++]=(255&e)/255*i,t[r++]=(e>>8&255)/255*i,t[r++]=(e>>16&255)/255*i,t[r++]=i}])},40766,e=>{e.s(["f",0,class{constructor(){this.batcherName="default",this.topology="triangle-list",this.attributeSize=4,this.indexSize=6,this.packAsQuad=!0,this.roundPixels=0,this._attributeStart=0,this._batcher=null,this._batch=null}get blendMode(){return this.renderable.groupBlendMode}get color(){return this.renderable.groupColorAlpha}reset(){this.renderable=null,this.texture=null,this._batcher=null,this._batch=null,this.bounds=null}destroy(){this.reset()}}])},33219,e=>{e.s(["f",0,class{constructor(e){this.items=Object.create(null);let{renderer:t,type:r,onUnload:i,priority:n,name:a}=e;this._renderer=t,t.gc.addResourceHash(this,"items",r,n??0),this._onUnload=i,this.name=a}add(e){return!this.items[e.uid]&&(this.items[e.uid]=e,e.once("unload",this.remove,this),e._gcLastUsed=this._renderer.gc.now,!0)}remove(e,...t){if(!this.items[e.uid])return;let r=e._gpuData[this._renderer.uid];r&&(this._onUnload?.(e,...t),e.off("unload",this.remove,this),r.destroy(),e._gpuData[this._renderer.uid]=null,this.items[e.uid]=null)}removeAll(...e){Object.values(this.items).forEach(t=>t&&this.remove(t,...e))}destroy(...e){this.removeAll(...e),this.items=Object.create(null),this._renderer=null,this._onUnload=null}}])},81834,49372,e=>{var t=e.i(47760);e.i(95932);let r="8.22.0";e.s(["f",0,r],49372);class i{static init(){globalThis.__PIXI_APP_INIT__?.(this,r)}static destroy(){}}i.extension=t.x.Application;class n{constructor(e){this._renderer=e}init(){globalThis.__PIXI_RENDERER_INIT__?.(this._renderer,r)}destroy(){this._renderer=null}}n.extension={type:[t.x.WebGLSystem,t.x.WebGPUSystem],name:"initHook",priority:-10},e.s(["L",0,i,"b",0,n],81834)}])})();