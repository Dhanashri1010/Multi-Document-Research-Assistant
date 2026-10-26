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
        doc.moveDown(1);
      }

      pageContent.sections.forEach((sec) => {
        if (sec.heading) {
          doc.fontSize(12).font('Helvetica-Bold').text(sec.heading);
          doc.moveDown(0.3);
        }
        doc.fontSize(10).font('Helvetica').text(sec.body, { align: 'justify', lineGap: 3 });
        doc.moveDown(0.8);
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
    subtitle: 'Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones (Google Brain / Research)',
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
        body: 'We compute the attention function on a set of queries simultaneously, packed together into a matrix Q. The keys and values are packed into matrices K and V. We compute the dot products of the query with all keys, divide each by the square root of the key dimension d_k, and apply a softmax function to obtain the weights on the values: Attention(Q, K, V) = softmax(Q K^T / sqrt(d_k)) V.',
      },
      {
        heading: '3.2 Multi-Head Attention',
        body: 'Instead of performing a single attention function with d_model-dimensional keys, values and queries, we found it beneficial to linearly project the queries, keys and values h times with different, learned linear projections to d_k, d_k and d_v dimensions, respectively. On each of these projected versions of queries, keys and values we then perform the attention function in parallel.',
      },
    ],
  },
  {
    title: 'Experimental Results & Limitations',
    subtitle: 'Section 5: Evaluation and Empirical Benchmarks',
    sections: [
      {
        heading: '5.1 Translation Benchmarks',
        body: 'On the WMT 2014 English-to-German translation task, the big transformer model establishes a new state-of-the-art BLEU score of 28.4, outperforming the best existing models by more than 2.0 BLEU points. On the WMT 2014 English-to-French translation task, our model establishes a state-of-the-art BLEU score of 41.8 after training for 3.5 days on eight GPUs.',
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
    subtitle: 'Edward J. Hu, Yelong Shen, Phillip Wallis, Zeyuan Allen-Zhu, Yuanzhi Li, Shean Wang (Microsoft)',
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
        body: 'A pre-trained weight matrix W_0 in R^{d x k} has an intrinsic rank that is much lower than its ambient dimensions during task adaptation. For W_0, we constrain its update by representing the update with a low-rank decomposition: Delta W = B * A, where B is in R^{d x r} and A is in R^{r x k}, with the rank r much smaller than min(d, k). During training, W_0 is frozen and receives no gradient updates, while A and B contain trainable parameters.',
      },
      {
        heading: '3.2 Scaling Factor alpha',
        body: 'When multiplying by input x, the forward pass yields h = W_0 x + Delta W x = W_0 x + (alpha / r) B A x. We use a constant hyperparameter alpha to scale the updates, simplifying hyperparameter tuning when changing the rank r.',
      },
    ],
  },
  {
    title: 'Results and Constraints',
    subtitle: 'Section 5: Empirical Benchmarks and Limitations',
    sections: [
      {
        heading: '5.1 Memory and Parameter Efficiency',
        body: 'LoRA reduces the number of trainable parameters by 10,000 times and GPU memory requirements by 3 times compared to full fine-tuning on GPT-3 175B. On the GLUE benchmark, LoRA performs on par with or better than full fine-tuning while requiring only a fraction of the trainable parameters.',
      },
      {
        heading: '6. Reported Limitations',
        body: 'LoRA introduces practical inference latency when switching between multiple task-specific adapters simultaneously in high-throughput multi-tenant serving environments if adapters cannot be dynamically fused into the base weights in real time. Processing batched inputs for diverse tasks in a single forward pass remains non-trivial.',
      },
    ],
  },
];

async function generateAll() {
  await createPdfFile(path.join(samplesDir, 'attention_is_all_you_need.pdf'), paper1);
  await createPdfFile(path.join(samplesDir, 'lora_low_rank_adaptation.pdf'), paper2);
  console.log('Valid academic PDFs created successfully with PDFKit.');
}

generateAll().catch(console.error);
