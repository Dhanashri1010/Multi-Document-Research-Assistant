import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

function createPdfFile(filePath, pages) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    pages.forEach((pageContent, idx) => {
      if (idx > 0) doc.addPage();

      doc.fontSize(16).font('Helvetica-Bold').text(pageContent.title, { align: 'center' });
      doc.moveDown(0.5);

      if (pageContent.subtitle) {
        doc.fontSize(10).font('Helvetica-Oblique').text(pageContent.subtitle, { align: 'center' });
        doc.moveDown(0.8);
      }

      pageContent.sections.forEach((sec) => {
        if (sec.heading) {
          doc.fontSize(12).font('Helvetica-Bold').text(sec.heading);
          doc.moveDown(0.3);
        }
        if (sec.body) {
          doc.fontSize(10).font('Helvetica').text(sec.body, { align: 'justify', lineGap: 3 });
          doc.moveDown(0.6);
        }
        if (sec.equation) {
          doc.fontSize(11).font('Courier-Bold').text(sec.equation, { align: 'center' });
          doc.moveDown(0.6);
        }
        if (sec.table) {
          doc.fontSize(9).font('Courier').text(sec.table, { align: 'left' });
          doc.moveDown(0.6);
        }
      });

      // Page footer
      doc.fontSize(8).font('Helvetica').text(`Page ${idx + 1}`, 50, 780, { align: 'center', width: 500 });
    });

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

const samplesDir = path.resolve('E:/Multi document Research Assistant/samples');
if (!fs.existsSync(samplesDir)) {
  fs.mkdirSync(samplesDir, { recursive: true });
}

// Paper 1: Attention Is All You Need
const paper1 = [
  {
    title: 'Attention Is All You Need',
    subtitle: 'Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones (Google Brain / Research, 2017)',
    sections: [
      {
        heading: 'Abstract',
        body: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train.',
      },
      {
        heading: '1. Introduction',
        body: 'Recurrent models typically factor computation along the symbol positions of the input and output sequences. Aligning the positions to steps in computation time, they generate a sequence of hidden states h_t, as a function of the previous hidden state h_{t-1} and the input for position t. This inherently sequential nature precludes parallelization within training examples, which becomes critical at longer sequence lengths.',
      },
    ],
  },
  {
    title: 'Model Architecture & Self-Attention',
    subtitle: 'Section 3: Attention Mechanism and Multi-Head Projections',
    sections: [
      {
        heading: '3.1 Scaled Dot-Product Attention',
        body: 'We compute the attention function on a set of queries simultaneously, packed together into a matrix Q. The keys and values are packed into matrices K and V. We compute the dot products of the query with all keys, divide each by the square root of the key dimension d_k, and apply a softmax function to obtain the weights on the values:',
        equation: 'Attention(Q, K, V) = softmax(Q K^T / sqrt(d_k)) V',
      },
      {
        heading: '3.2 Multi-Head Attention',
        body: 'Instead of performing a single attention function with d_model-dimensional keys, values and queries, we found it beneficial to linearly project the queries, keys and values h times with different, learned linear projections to d_k, d_k and d_v dimensions, respectively. For the base model, we employ h = 8 parallel attention layers or heads. For each of these, we use d_k = d_v = d_model / h = 64. On each of these projected versions of queries, keys and values we then perform the attention function in parallel.',
      },
    ],
  },
  {
    title: 'Experimental Results & Limitations',
    subtitle: 'Section 5: Evaluation, Empirical Benchmarks and Limitations',
    sections: [
      {
        heading: '5.1 Translation Benchmarks Table',
        body: 'Below are the empirical BLEU scores and training costs across translation benchmarks compared to prior recurrent and convolutional architectures:',
        table: 'Model                | WMT14 En-De | WMT14 En-Fr | Training Time\n---------------------|-------------|-------------|--------------\nByteNet              | 23.75       | -           | -\nConvS2S              | 25.16       | 40.46       | 9.6 days (8 P100)\nTransformer (base)   | 27.30       | 38.10       | 12 hours (8 P100)\nTransformer (big)    | 28.40       | 41.80       | 3.5 days (8 P100)',
      },
      {
        heading: '6. Reported Limitations',
        body: 'A key reported limitation is that standard self-attention has a computational complexity and memory footprint of O(n^2) with respect to the sequence length n. This quadratic complexity limits direct application of standard transformers to extremely long context windows without specialized sparse or linear approximation techniques.',
      },
    ],
  },
];

// Paper 2: LoRA: Low-Rank Adaptation of Large Language Models
const paper2 = [
  {
    title: 'LoRA: Low-Rank Adaptation of Large Language Models',
    subtitle: 'Edward J. Hu, Yelong Shen, Phillip Wallis, Zeyuan Allen-Zhu, Yuanzhi Li, Shean Wang (Microsoft, 2021)',
    sections: [
      {
        heading: 'Abstract',
        body: 'An important paradigm of natural language processing consists of large-scale pre-training on general domain data and adaptation to specific tasks. Full fine-tuning of all parameters becomes prohibitively expensive as model sizes scale to hundreds of billions of parameters. We propose Low-Rank Adaptation, or LoRA, which freezes the pre-trained model weights and injects trainable rank decomposition matrices into each layer of the Transformer architecture, greatly reducing the number of trainable parameters for downstream tasks.',
      },
      {
        heading: '1. Introduction',
        body: 'Many applications in natural language processing rely on adapting one large, pre-trained language model to multiple downstream tasks. The primary drawback for full fine-tuning is that for each downstream task, we learn a completely new set of model parameters. When deploying 175B GPT-3 models, storing independent fine-tuned checkpoints is cost-prohibitive.',
      },
    ],
  },
  {
    title: 'Methodology and Low-Rank Decomposition',
    subtitle: 'Section 3: Problem Formulation and Weight Updates',
    sections: [
      {
        heading: '3.1 Low-Rank Parameter Decomposition',
        body: 'A pre-trained weight matrix W_0 in R^{d x k} has an intrinsic rank that is much lower than its ambient dimensions during task adaptation. For W_0, we constrain its update by representing the update with a low-rank decomposition: Delta W = B * A, where B is in R^{d x r} and A is in R^{r x k}, with the rank r much smaller than min(d, k). During training, W_0 is frozen and receives no gradient updates, while A and B contain trainable parameters. We use a random Gaussian initialization for A and zero for B, so Delta W = B A is initially zero at the beginning of training.',
      },
      {
        heading: '3.2 Scaling Factor alpha',
        body: 'When multiplying by input x, the forward pass yields the modified activation formula:',
        equation: 'h = W_0 x + Delta W x = W_0 x + (alpha / r) B A x',
      },
    ],
  },
  {
    title: 'Results and Constraints',
    subtitle: 'Section 5: Empirical Benchmarks and Limitations',
    sections: [
      {
        heading: '5.1 Memory and Parameter Efficiency Table',
        body: 'Empirical comparison of trainable parameter counts and memory usage during adaptation of GPT-3 175B:',
        table: 'Method          | Trainable Params | GPU Memory | Checkpoint Size\n----------------|------------------|------------|----------------\nFull Fine-Tune  | 175,000M (100%)  | 1.2 TB     | 350 GB\nPrefix Tuning   | 350M (0.2%)      | 450 GB     | 700 MB\nLoRA (r=4)      | 18M (0.01%)      | 350 GB     | 35 MB\nLoRA (r=8)      | 36M (0.02%)      | 360 GB     | 70 MB',
      },
      {
        heading: '6. Reported Limitations',
        body: 'LoRA introduces practical inference latency when switching between multiple task-specific adapters simultaneously in high-throughput multi-tenant serving environments if adapters cannot be dynamically fused into the base weights in real time. Processing batched inputs for diverse tasks in a single forward pass remains non-trivial.',
      },
    ],
  },
];

// Paper 3: BERT: Pre-training of Deep Bidirectional Transformers
const paper3 = [
  {
    title: 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding',
    subtitle: 'Jacob Devlin, Ming-Wei Chang, Kenton Lee, Kristina Toutanova (Google AI Language, 2018)',
    sections: [
      {
        heading: 'Abstract',
        body: 'We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers. As a result, the pre-trained BERT model can be fine-tuned with just one additional output layer to create state-of-the-art models for a wide range of tasks, such as question answering and language inference, without substantial task-specific architecture modifications.',
      },
      {
        heading: '1. Introduction',
        body: 'Language model pre-training has been shown to be effective for improving many natural language processing tasks. There are two existing strategies for applying pre-trained language representations to downstream tasks: feature-based and fine-tuning. In this paper, we argue that current techniques restrict the power of pre-trained representations because standard language models are unidirectional, which limits the choice of architectures during pre-training.',
      },
    ],
  },
  {
    title: 'BERT Pre-training Objectives',
    subtitle: 'Section 3: Masked Language Model and Next Sentence Prediction',
    sections: [
      {
        heading: '3.1 Masked LM (MLM)',
        body: 'In order to train a deep bidirectional representation, we simply mask some percentage of the input tokens at random, and then predict those masked tokens. We refer to this procedure as a Masked LM (MLM). In all of our experiments, we mask 15% of all WordPiece tokens in each sequence at random. Of the selected tokens, 80% are replaced with the [MASK] token, 10% are replaced with a random token, and 10% are kept unchanged.',
        equation: 'Loss_MLM = - sum_{i in Masked} log P(w_i | Context_{-i})',
      },
      {
        heading: '3.2 Next Sentence Prediction (NSP)',
        body: 'In order to train a model that understands sentence relationships, we pre-train for a binarized next sentence prediction task that can be trivially generated from any monolingual corpus. When choosing sentences A and B, 50% of the time B is the actual next sentence (labeled as IsNext), and 50% of the time it is a random sentence from the corpus (labeled as NotNext).',
      },
    ],
  },
  {
    title: 'Model Sizes, GLUE Benchmark & Limitations',
    subtitle: 'Section 5: Empirical Results across GLUE Tasks',
    sections: [
      {
        heading: '5.1 BERT Architecture Configurations and GLUE Scores',
        body: 'Table comparing BERT architectures and GLUE average accuracy scores against prior baselines:',
        table: 'Model       | Layers (L) | Hidden (H) | Heads (A) | Total Params | GLUE Score\n------------|------------|------------|-----------|--------------|-----------\nOpenAI GPT  | 12         | 768        | 12        | 117M         | 72.8%\nBERT_BASE   | 12         | 768        | 12        | 110M         | 79.6%\nBERT_LARGE  | 24         | 1024       | 16        | 340M         | 80.5%',
      },
      {
        heading: '6. Computational Costs and Limitations',
        body: 'Pre-training BERT is computationally expensive: BERT_BASE required 4 days on 4 Cloud TPU v2 pods (16 TPU chips), while BERT_LARGE required 4 days on 16 Cloud TPU v2 pods (64 TPU chips). Furthermore, BERT enforces a rigid maximum sequence length limit of 512 tokens due to learned positional embeddings and quadratic self-attention memory requirements.',
      },
    ],
  },
];

// Paper 4: Deep Residual Learning for Image Recognition (ResNet)
const paper4 = [
  {
    title: 'Deep Residual Learning for Image Recognition',
    subtitle: 'Kaiming He, Xiangyu Zhang, Shaoqing Ren, Jian Sun (Microsoft Research, 2015)',
    sections: [
      {
        heading: 'Abstract',
        body: 'Deeper neural networks are more difficult to train. We present a residual learning framework to ease the training of networks that are substantially deeper than those used previously. We explicitly reformulate the layers as learning residual functions with reference to the layer inputs, instead of learning unreferenced functions. We provide comprehensive empirical evidence showing that these residual networks are easier to optimize, and can gain accuracy from considerably increased depth. On ImageNet, we evaluate residual nets with a depth of up to 152 layers—8x deeper than VGG nets but still having lower complexity.',
      },
      {
        heading: '1. Degradation Problem',
        body: 'When deeper networks are able to start converging, a degradation problem has been exposed: with network depth increasing, accuracy gets saturated and then degrades rapidly. Unexpectedly, such degradation is not caused by overfitting, and adding more layers to a suitably deep model leads to higher training error, as verified by extensive experiments on CIFAR-10 and ImageNet.',
      },
    ],
  },
  {
    title: 'Residual Mapping Formulation',
    subtitle: 'Section 3: Deep Residual Learning Formulation and Shortcut Connections',
    sections: [
      {
        heading: '3.1 Residual Building Block',
        body: 'Let us consider H(x) as an underlying mapping to be fit by a few stacked layers, with x denoting the inputs to the first of these layers. We hypothesize that multiple nonlinear layers can asymptotically approximate residual functions H(x) - x. Rather than expecting stacked layers to approximate H(x), we explicitly let these layers approximate a residual mapping F(x) = H(x) - x. The original mapping is recast into:',
        equation: 'y = F(x, {W_i}) + x',
      },
      {
        heading: '3.2 Identity Shortcut Connections',
        body: 'The operation F + x by shortcut connections and element-wise addition introduces neither extra parameters nor computation complexity. The dimensions of x and F must be equal. When changing input/output channels, linear projection W_s can be performed: y = F(x, {W_i}) + W_s x.',
      },
    ],
  },
  {
    title: 'ImageNet Benchmarks & Bottleneck Architecture',
    subtitle: 'Section 5: Empirical Benchmarks on ImageNet 2012 Classification',
    sections: [
      {
        heading: '5.1 ImageNet Error Rates Table',
        body: 'ImageNet classification top-1 and top-5 error rates for plain networks vs. residual networks:',
        table: 'Network      | Layers | FLOPs     | Top-1 Error | Top-5 Error\n-------------|--------|-----------|-------------|------------\nVGG-16       | 16     | 15.3 x 10^9| 28.07%      | 9.33%\nVGG-19       | 19     | 19.6 x 10^9| 28.05%      | 9.12%\nResNet-34    | 34     | 3.6 x 10^9 | 21.84%      | 5.71%\nResNet-50    | 50     | 3.8 x 10^9 | 20.74%      | 5.25%\nResNet-101   | 101    | 7.6 x 10^9 | 19.87%      | 4.60%\nResNet-152   | 152    | 11.3 x 10^9| 19.38%      | 4.49%',
      },
      {
        heading: '6. Bottleneck Design and Conclusions',
        body: 'For deeper networks such as ResNet-50, 101, and 152, we use a 3-layer bottleneck block consisting of 1x1, 3x3, and 1x1 convolutions. The 1x1 layers are responsible for reducing and then restoring dimensions, leaving the 3x3 layer a bottleneck with smaller input/output dimensions.',
      },
    ],
  },
];

// Paper 5: Language Models are Few-Shot Learners (GPT-3)
const paper5 = [
  {
    title: 'Language Models are Few-Shot Learners',
    subtitle: 'Tom B. Brown, Benjamin Mann, Nick Ryder, Melanie Subbiah, Jared Kaplan et al. (OpenAI, 2020)',
    sections: [
      {
        heading: 'Abstract',
        body: 'Recent work has demonstrated substantial gains on many NLP tasks and benchmarks by pre-training on a large corpus of text followed by fine-tuning on a specific task. While typically task-agnostic in architecture, this method still requires task-specific fine-tuning datasets of thousands or tens of thousands of examples. Here we show that scaling up language models greatly improves task-agnostic, few-shot performance, sometimes even reaching competitiveness with prior state-of-the-art fine-tuning approaches. We train GPT-3, an autoregressive language model with 175 billion parameters, 10x more than any previous non-sparse language model, and test its performance in the few-shot setting.',
      },
      {
        heading: '1. In-Context Learning',
        body: 'Our goal is to investigate whether scaling parameters alone enables in-context learning, where the model is conditioned on natural language descriptions of the task and a few prompt demonstrations without performing any parameter updates or weight modifications.',
      },
    ],
  },
  {
    title: 'GPT-3 Architecture & Scaling',
    subtitle: 'Section 2: Architecture Specifications across Parameter Scales',
    sections: [
      {
        heading: '2.1 Model Specifications Table',
        body: 'Specifications for the eight distinct GPT-3 model sizes evaluated in the scaling study:',
        table: 'Model Name    | Total Params | Layers | d_model | Heads | Batch Size (Tokens)\n--------------|--------------|--------|---------|-------|--------------------\nGPT-3 Small   | 125M         | 12     | 768     | 12    | 0.5M\nGPT-3 Medium  | 350M         | 24     | 1024    | 16    | 0.5M\nGPT-3 Large   | 760M         | 24     | 1536    | 16    | 0.5M\nGPT-3 XL      | 1.3B         | 24     | 2048    | 16    | 1.0M\nGPT-3 2.7B    | 2.7B         | 32     | 2560    | 32    | 1.0M\nGPT-3 6.7B    | 6.7B         | 32     | 4096    | 32    | 2.0M\nGPT-3 13B     | 13.0B        | 40     | 5120    | 40    | 2.0M\nGPT-3 175B    | 175.0B       | 96     | 12288   | 96    | 3.2M',
      },
      {
        heading: '2.2 Training Compute Scaling Law',
        body: 'GPT-3 175B was trained on 300 billion tokens from Common Crawl, WebText2, Books1, Books2, and Wikipedia using 3.14 x 10^23 FLOPS of compute.',
      },
    ],
  },
  {
    title: 'Performance & Limitations',
    subtitle: 'Section 4: Empirical Findings and Critical Constraints',
    sections: [
      {
        heading: '4.1 SuperGLUE Benchmark Performance',
        body: 'On the SuperGLUE benchmark, zero-shot GPT-3 175B achieves 71.8%, while few-shot (32 examples in context) achieves 75.6%, closing the gap with fine-tuned BERT-large models while requiring zero gradient steps on the target task.',
      },
      {
        heading: '5. Limitations & Societal Impacts',
        body: 'GPT-3 has noticeable limitations: it struggles with semantic comparison tasks (e.g. WiC), physical common sense reasoning, and long-range coherence beyond its 2048-token context window. Furthermore, sampling can produce factually incorrect hallucinations, and fine-tuning remains expensive due to model scale.',
      },
    ],
  },
];

// Paper 6: Adam: A Method for Stochastic Optimization
const paper6 = [
  {
    title: 'Adam: A Method for Stochastic Optimization',
    subtitle: 'Diederik P. Kingma, Jimmy Lei Ba (University of Amsterdam, University of Toronto, 2014)',
    sections: [
      {
        heading: 'Abstract',
        body: 'We introduce Adam, an algorithm for first-order gradient-based optimization of stochastic objective functions, based on adaptive estimates of lower-order moments. The method is straightforward to implement, is computationally efficient, has little memory requirements, is invariant to diagonal rescaling of the gradients, and is well suited for problems that are large in terms of data and/or parameters. The method is also appropriate for non-stationary objectives and problems with very noisy and/or sparse gradients.',
      },
      {
        heading: '1. Introduction',
        body: 'Stochastic gradient-based optimization is of core practical importance in many fields of science and engineering. Many problems can be cast as the optimization of an expected value of an objective function with respect to parameters theta. Adam combines the advantages of two popular methods: AdaGrad (which works well with sparse gradients) and RMSProp (which works well in on-line and non-stationary settings).',
      },
    ],
  },
  {
    title: 'Algorithm & Moment Equations',
    subtitle: 'Section 2: Mathematical Formulation of First and Second Moments',
    sections: [
      {
        heading: '2.1 Moving Averages and Bias Correction',
        body: 'Let g_t be the gradient at step t. The moving averages of the gradient m_t and squared gradient v_t are updated with decay rates beta_1 and beta_2:',
        equation: 'm_t = beta_1 m_{t-1} + (1 - beta_1) g_t,   v_t = beta_2 v_{t-1} + (1 - beta_2) g_t^2',
      },
      {
        heading: '2.2 Bias-Corrected Estimates and Parameter Update',
        body: 'Since m_t and v_t are initialized as zero vectors, they are biased toward zero, especially during initial steps. Bias-corrected estimates hat{m}_t and hat{v}_t are computed as hat{m}_t = m_t / (1 - beta_1^t) and hat{v}_t = v_t / (1 - beta_2^t). The parameter update rule is:',
        equation: 'theta_t = theta_{t-1} - (alpha * hat{m}_t) / (sqrt(hat{v}_t) + epsilon)',
      },
    ],
  },
  {
    title: 'Default Hyperparameters & Empirical Convergence',
    subtitle: 'Section 4: Recommended Default Settings and Empirical Results',
    sections: [
      {
        heading: '4.1 Default Hyperparameters Table',
        body: 'Recommended standard hyperparameter configurations across machine learning problems:',
        table: 'Hyperparameter | Symbol  | Default Value | Description\n---------------|---------|---------------|-----------------------------------\nLearning Rate  | alpha   | 0.001         | Step size / scaling factor\nFirst Moment   | beta_1  | 0.9           | Exponential decay for first moment\nSecond Moment  | beta_2  | 0.999         | Exponential decay for second moment\nNumerical Stab | epsilon | 1e-8          | Division by zero prevention',
      },
      {
        heading: '5. Limitations',
        body: 'Adam requires maintaining two additional state vectors (m_t and v_t) for each parameter in the model, tripling the memory requirement for model weights during optimization. Furthermore, in certain non-convex optimization problems, the learning rate schedule can fail to converge, motivating subsequent modifications such as AMSGrad and AdamW with decoupled weight decay.',
      },
    ],
  },
];

async function generateAll() {
  await createPdfFile(path.join(samplesDir, 'attention_is_all_you_need.pdf'), paper1);
  await createPdfFile(path.join(samplesDir, 'lora_low_rank_adaptation.pdf'), paper2);
  await createPdfFile(path.join(samplesDir, 'bert_pretraining_deep_bidirectional.pdf'), paper3);
  await createPdfFile(path.join(samplesDir, 'resnet_deep_residual_learning.pdf'), paper4);
  await createPdfFile(path.join(samplesDir, 'gpt3_language_models_few_shot.pdf'), paper5);
  await createPdfFile(path.join(samplesDir, 'adam_stochastic_optimization.pdf'), paper6);
  console.log('Successfully generated 6 academic benchmark PDFs in samples/ directory.');
}

generateAll().catch(console.error);
