# Distribuir a extensão pelo Drive, enquanto a loja não aprova

Solução **temporária**, para a equipe da Wicomm usar antes de a extensão sair na
Chrome Web Store ([T-011](../tasks/extensao.md#t-011--como-o-cliente-instala-isso)).
Serve a quem é do time; **não serve a cliente** — é o motivo de a T-011 existir.

Quando a loja aprovar, o link da Web Store substitui tudo isto, e este runbook
vira histórico.

---

## O que vai para a pasta do Drive

| Arquivo | De onde sai |
|---|---|
| `login-de-teste-wicomm-<versão>.zip` | do comando abaixo |
| `COMO INSTALAR - leia antes.txt` | cópia de [`como-instalar-pelo-drive.txt`](como-instalar-pelo-drive.txt), renomeada |

Renomear o `.txt` é de propósito: numa lista do Drive, `como-instalar-pelo-drive`
não chama atenção de quem só quer baixar. **`COMO INSTALAR - leia antes`** chama.

Há também uma versão em página, mais fácil de mandar no WhatsApp que um `.txt`:
o mesmo conteúdo, publicado como artifact. O link vive no card da T-011.

## Gerar o zip

```bash
cd extension && zip -rq ../login-de-teste-wicomm-1.0.0.zip . -x '.*' -x '*/.*' && cd ..
unzip -l login-de-teste-wicomm-1.0.0.zip
```

O `-x` tira `.DS_Store` e afins. Confira na listagem que o `manifest.json` está na
**raiz** do zip — se estiver dentro de uma subpasta, o Chrome recusa a instalação.

⚠️ **A `version` do manifesto tem de subir junto.** Duas pessoas com pastas de
conteúdo diferente e o mesmo número de versão é o tipo de confusão que consome
uma tarde: uma diz que o bug sumiu, a outra diz que não.

## Os três jeitos de isso dar errado

São os três que o `.txt` explica, e são todos do mesmo tipo — o Chrome
**não copia** os arquivos, ele lê da pasta original toda vez:

1. **Apontar para o `.zip`** em vez da pasta descompactada. No Windows, o duplo
   clique no zip abre uma pré-visualização cuja pasta é temporária: instala,
   funciona, e some sozinha depois.
2. **Mover, renomear ou apagar a pasta** depois de instalar. A extensão morre, e
   o sintoma não aponta para a causa.
3. **Clicar em "Desativar"** no aviso de modo desenvolvedor que o Chrome mostra a
   cada abertura. Fechar no X é o certo.

## Atualizar quem já instalou

Não tem automático — é a diferença que a Web Store faz. Mande o zip novo, e a
pessoa substitui a pasta e clica em recarregar (↻) no card da extensão em
`chrome://extensions`.

Por isso **vale a pena não distribuir versão intermediária**: cada uma é um
pedido manual para todo mundo, e quem não fizer fica para trás sem saber.
