## 1. 沿海列车归还相机：80 秒多-shot 主 Demo

  请实际调用 reca_create_video 创建视频，不要只给出方案，不要使用 Bash，也不要直接请求 Gateway。

  调用时必须显式传入：

  backend: wan
  force_i2v: false
  duration: 80
  resolution: 1920x1080
  aspect_ratio: 16:9
  seed: 0
  enable_audit: true
  validate_segments: true
  style: premium cinematic coastal drama, realistic Chinese seaside town, warm festival lights, blue ocean daylight, authentic train and clothing materials, smooth
  restrained camera movement

  不要手动指定 shot 数量，由 ReCA 自主完成 shot 规划、segment 拆分、参考图生成、视频生成、验证、修复和拼接。使用 GPT Image 2 生成人物、地点和关键道具参考图，并让 Wan
  3.0 在有参考图的 segment 中采用默认 R2V。

  story:
  请制作一条约 80 秒、1920x1080 的写实电影感视频。

  故事发生在一座临海小镇。一名叫叶南的年轻女子穿浅灰蓝色风衣、白色衬衫和深色长裤，背着棕色单肩包。她在靠海火车月台的一张长椅旁发现一台被遗落的银色胶片相机。她拿起相机
  检查，发现不远处一名穿黄色雨披的小女孩正登上一列蓝白色老式慢车，于是意识到相机可能属于她。

  叶南带着银色相机追上慢车，进入木质装饰的老式车厢。她沿狭窄过道向前寻找，乘客自然让出通道。列车短暂停靠后，她跟随黄色雨披的身影离开车厢，经过连接车站与渔港的海堤桥。

  她进入挂满彩色旗帜和暖色灯笼的渔港节日街，在人群边缘寻找小女孩。小女孩最终在通往白色灯塔的木质栈道前停下并回头。叶南走到她面前，将银色胶片相机交还。小女孩接过相机，
  两人一起转向灯塔和明亮海面，远处渔船正在进港，故事在平静温暖的海岸宽镜头中结束。

  连续性要求：
  - 叶南始终是同一名女子，保持浅灰蓝风衣、棕色单肩包不变。
  - 小女孩始终穿同一件黄色雨披。
  - 银色胶片相机必须是同一件道具，状态依次为遗落、被叶南拿起、携带、归还。
  - 蓝白慢车、海堤桥、渔港节日街和白色灯塔属于同一座临海小镇。
  - 人物移动方向和空间关系必须清楚。
  - 不要复制人物，不要改变服装颜色，不要让相机突然消失，不要重复归还动作。

  工具调用成功后，只返回 run_id、初始状态和 reca_create_video 的实际参数。

  ## 2. 厨房救场：54 秒物体与动作连续性

  请实际调用 reca_create_video 创建视频，不要只给出方案，不要使用 Bash，也不要直接请求 Gateway。

  调用时必须显式传入：

  backend: wan
  force_i2v: false
  duration: 54
  resolution: 1920x1080
  aspect_ratio: 16:9
  seed: 0
  enable_audit: true
  validate_segments: true
  style: premium realistic culinary commercial, high-end open kitchen, warm practical lighting, authentic food and metal textures, precise close-ups, smooth
  controlled camera movement

  不要手动指定 shot 数量，由 ReCA 自主决定 shot 和 segment。使用 GPT Image 2 生成人物、厨房、铜锅、餐盘和柠檬海鱼参考图。保持参考资产贯穿整个视频，让 Wan 3.0 默认采用
  R2V。

  story:
  请制作一条约 54 秒、1920x1080 的高端写实餐饮电影短片。

  周五晚餐高峰，一家现代开放式餐厅厨房正在紧张出餐。年轻女主厨安乔穿干净的白色厨师服，系暗红色围裙，头发整齐束起。她发现铜锅中的同一块柠檬海鱼即将火候过度，于是立即开
  始补救。

  首先用厨房宽镜建立安乔、灶台、铜锅和出餐口的位置关系。安乔用金属夹稳定地将鱼排翻面，使鱼皮朝上。服务员在出餐口等待，传递出时间压力，但不干扰安乔操作。

  安乔向铜锅中加入一小块黄油、两片柠檬和少量香草。黄油融化后，她用同一把金属勺把锅中的酱汁反复淋在同一块鱼排表面。鱼排逐渐呈现完整、湿润而有光泽的状态。

  副厨从一旁递来一个干净的白色圆盘。安乔使用金属夹，把同一块鱼排从铜锅稳定转移到白盘中央，随后添加锅中的柠檬片、少量酱汁和绿色香草。她擦净盘边，完成最后检查，将餐盘推
  到出餐口。等待的服务员端走这份柠檬海鱼，安乔在背景中短暂松一口气。

  连续性要求：
  - 安乔始终保持相同面部、发型、白色厨师服和暗红围裙。
  - 铜锅、金属夹、金属勺、白色圆盘必须保持一致。
  - 全程只能有同一块柠檬海鱼。
  - 鱼排状态必须按锅中煎制、淋汁、转移到白盘、完成摆盘的顺序变化。
  - 不要重复翻面、转移或摆盘动作。
  - 不要让鱼排、餐盘或厨具突然消失或复制。
  - 厨房宽镜、手部近景、锅内特写和餐盘特写之间可以切换，但动作状态必须连续。

  工具调用成功后，只返回 run_id、初始状态和 reca_create_video 的实际参数。

  ## 3. 废弃灯塔：45 秒工具包原生多-shot 示例

  请实际调用 reca_create_video 创建视频，不要只给出方案，不要使用 Bash，也不要直接请求 Gateway。

  调用时必须显式传入：

  backend: wan
  force_i2v: false
  duration: 45
  resolution: 1920x1080
  aspect_ratio: 16:9
  seed: 31001
  enable_audit: true
  validate_segments: true
  style: cinematic maritime mystery, realistic storm lighting, wet stone and metal textures, blue night balanced by warm flashlight, smooth escalating camera movement

  不要手动拆分 shot，让 ReCA 自主规划完整流程。使用 GPT Image 2 生成人物、灯塔地点和关键道具参考图，并让 Wan 3.0 使用默认 R2V。

  story:
  生成一段约 45 秒、1920x1080 的写实电影感视频。

  暴雨夜，一名年轻女研究员穿深绿色防水长外套、背棕色皮质工具包，来到海边一座废弃灯塔。她推开生锈铁门，手持暖黄色手电进入潮湿大厅，在斑驳墙面上发现一张残破航海图。她用
  手指沿地图上的红色航线移动，随后听见塔顶传来金属撞击声。

  她沿狭窄、湿滑的螺旋楼梯谨慎上行，经过一扇破碎窗户时短暂停下。闪电照亮窗外海面，她继续向上，最终抵达灯塔顶部，看见远处海面上的闪电，以及一艘在风暴中若隐若现的旧船。
  最后以灯塔外部和暴雨海面的宽镜头收束。

  保持同一名研究员、深绿色外套、棕色工具包和暖黄色手电。大厅、楼梯和塔顶必须属于同一座灯塔，空间移动方向连续清楚。镜头节奏从谨慎缓慢逐渐变得紧张。不要新增人物，不要改
  变服装和工具包，不要重复上下楼动作。

  工具调用成功后，只返回 run_id、初始状态和 reca_create_video 的实际参数。

  ## 4. 孙悟空与杨戬：30 秒工具包原生动作示例

  请实际调用 reca_create_video 创建视频，不要只给出方案，不要使用 Bash，也不要直接请求 Gateway。

  调用时必须显式传入：

  backend: wan
  force_i2v: false
  duration: 30
  resolution: 1920x1080
  aspect_ratio: 16:9
  seed: 31004
  enable_audit: true
  validate_segments: true
  style: premium realistic Chinese mythology epic, bright golden-hour sunlight, authentic armor and cloth, natural dust and sparks, powerful controlled action

  不要手动拆分 shot，让 ReCA 自主完成规划。使用 GPT Image 2 分别生成孙悟空、杨戬和荒古战场参考图，并让 Wan 3.0 使用默认 R2V。

  story:
  请制作一条约 30 秒、1920x1080 的高质量中国神话电影短片。

  故事发生在明亮的日落前黄金时刻。荒古战场上，孙悟空和杨戬隔着飞扬的尘土对峙。孙悟空穿暗金铠甲，披着被风吹起的深红披风，双手持金箍棒；杨戬穿银黑色战甲，手持三尖两刃
  刀。

  孙悟空压低身体快速逼近，从右侧挥动金箍棒。杨戬向后移动半步，用三尖两刃刀完成一次清晰有力的格挡。两件武器碰撞，产生短暂火花和冲击尘土。碰撞后两人立即分开，各自退回数
  米，最后在夕阳和尘土中重新对峙。

  连续性要求：
  - 两位角色的面部、体型、发型和身份必须保持一致。
  - 孙悟空始终穿暗金铠甲和深红披风，始终使用金箍棒。
  - 杨戬始终穿银黑战甲，始终使用三尖两刃刀。
  - 进攻、格挡、碰撞和分开各发生一次。
  - 不要交换武器，不要复制人物，不要新增军队或怪物。
  - 不要重复挥棒或格挡动作。
  - 动作需要有重量感，避免过快剪辑和混乱镜头。

  工具调用成功后，只返回 run_id、初始状态和 reca_create_video 的实际参数。

  ## 5. 雨夜电影人：工具包英文原生故事的完整版本

  请实际调用 reca_create_video 创建视频，不要只给出方案，不要使用 Bash，也不要直接请求 Gateway。

  调用时必须显式传入：

  backend: wan
  force_i2v: false
  duration: 45
  resolution: 1920x1080
  aspect_ratio: 16:9
  seed: 31002
  enable_audit: true
  validate_segments: true
  style: premium realistic urban cinema, reflective wet streets, warm studio and shop lights, deep blue rainy evening, smooth tracking camera

  不要手动指定 shot 数量，让 ReCA 自主进行 shot 和 segment 规划。使用 GPT Image 2 生成人物、复古摄影机、工作室、街道和火车站参考图，并让 Wan 3.0 使用默认 R2V。

  story:
  请制作一条约 45 秒、1920x1080 的写实城市电影短片。

  黄昏时，一名短发年轻女电影人穿米色风衣、深蓝色围巾，抱着一台银黑色复古胶片摄影机离开安静的工作室。她进入被雨水、霓虹灯和商店暖光照亮的城市街道。

  经过路口时，摄影机背带从肩上滑落，摄影机掉在湿润路边。她立刻停下并蹲下，捡起同一台摄影机，检查镜头和胶卷仓，确认没有损坏，然后将背带牢牢绕在手腕上。

  远处火车站开始播报末班车。她抱紧摄影机，穿过雨幕向车站奔跑，最终在站台入口停下，回头看向身后的雨夜街道，然后转身进入车站。

  连续性要求：
  - 始终是同一名短发女子。
  - 米色风衣、深蓝围巾和银黑色胶片摄影机保持一致。
  - 摄影机掉落、捡起、检查和重新携带只发生一次。
  - 工作室、街道和车站之间的移动关系自然。
  - 不要改变摄影机外形，不要让摄影机突然消失。
  - 不要突然停止下雨，不要新增同行人物，不要重复奔跑动作。

  工具调用成功后，只返回 run_id、初始状态和 reca_create_video 的实际参数。

  建议实际提交顺序：

  1. 沿海列车：主要多-shot 展示。
  2. 厨房救场：动作与物体一致性。
  3. 灯塔：空间与氛围。
  4. 雨夜电影人：人物和道具。
  5. 孙悟空：双人物高速动作压力测试。

  每次只提交一个任务。拿到 run_id 后先确认规划和 R2V 日志正常，再提交下一条，避免同时消耗大量视频调用额度。