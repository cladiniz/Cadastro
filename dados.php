<?php

include_once 'db.inc.php';

class Dados{

	//  Key e url geocoding mapbox
	var $mb_key = 'pk.eyJ1IjoiYml0ZWxvMTAiLCJhIjoiY2syeGQyNXZuMGFibDNvbGNuNDRoNG4yaCJ9.UpbuMafjZJFJqid9Mems9Q';
	var $mb_url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/%s.json?country=BR&access_token=%s';
	
	//  Vai sempre retornar JSON
	var $ret = ['error' => FALSE];

	//  Nome de estados para usar no geocode
	//  as respostas são melhores com nomes ao invés de siglas
	var $uf = [
		'AC' => 'Acre',	'AL' => 'Alagoas', 'AP' => 'Amapá',	'AM' => 'Amazonas',	'BA' => 'Bahia',
		'CE' => 'Ceará', 'DF' => 'Distrito Federal', 'ES' => 'Espírito Santo', 'GO' => 'Goiás',
		'MA' => 'Maranhão', 'MT' => 'Mato Grosso', 'MS' => 'Mato Grosso do Sul', 'MG' => 'Minas Gerais',
		'PA' => 'Pará',	'PB' => 'Paraíba', 'PR' => 'Paraná', 'PE' => 'Pernambuco', 'PI' => 'Piauí',
		'RJ' => 'Rio de Janeiro', 'RN' => 'Rio Grande do Norte', 'RS' => 'Rio Grande do Sul',
		'RO' => 'Rondônia',	'RR' => 'Roraima', 'SC' => 'Santa Catarina', 'SP' => 'São Paulo',
		'SE' => 'Sergipe', 'TO' => 'Tocantins'
	];
	
	public function __construct(){

		$this -> db = new DB;

		//  Confere acao em GET ou POST, chama a função se ela existe
		if (!$this -> db -> error){

			if ($_SERVER['REQUEST_METHOD'] === 'GET' && array_key_exists('acao', $_GET)){
				$acao = $_GET['acao'];
			}else if ($_SERVER['REQUEST_METHOD'] === 'POST' && array_key_exists('acao', $_POST)){
				$acao = $_POST['acao'];
			}else{
				$acao = FALSE;				
			}

			if ($acao && method_exists($this, $acao)){				
				call_user_func(array($this, $acao), $_SERVER['REQUEST_METHOD'] === 'GET' ? $_GET : $_POST);
			}else{
				$this -> ret = ['error' => TRUE, 'error_data' => ['invalid', 'Requisição Inválida']];
			}
			
		}else{
			$this -> ret = ['error' => TRUE, 'error_data' => $this -> db -> error_data];
		}

		echo json_encode($this -> ret);

	}

	//  Adiciona ou edita o registro
	private function add_edit($data){

		//  Confirma os dados
		$check = $this -> check($data);
		
		if (!$check[0]){		

			$params = $check[1];

			//  Parâmetros com geocode
			$params = array_merge($check[1], $check[2] ? $this -> geocode($check[2]) : [0, 0]);

			$campos = ['nome', 'sexo', 'dob', 'cep', 'endereco', 'numero', 'complemento',
					   'bairro', 'cidade', 'uf', 'lat', 'lon'];

			//  Adiciona
			if ($data['tipo'] == 'add'){
				
				$query = sprintf('INSERT INTO %s.cl_dados (', $this -> db -> config['db']);
				$query .= implode(', ', $campos);
				$query .= ') VALUES ('. implode(', ', array_fill(0, count($campos), '?')). ')';

				if ($this -> db -> query($query, $params)){
					$this -> ret['msg_01'] = 'Registro adicionado com sucesso';					
				}else{
					$this -> ret = ['error' => TRUE, 'error_data' => $this -> db -> error_data];
				}

			//  Edita	
			}else{

				$query = sprintf('UPDATE %s.cl_dados SET ', $this -> db -> config['db']);
				$query .= implode(' = ?, ', $campos). ' = ? WHERE id = ? LIMIT 1';
				$params[] = $data['id'];

				if ($this -> db -> query($query, $params)){
					$this -> ret['msg_01'] = 'Registro editado com sucesso';					
				}else{
					$this -> ret = ['error' => TRUE, 'error_data' => $this -> db -> error_data];
				}

			}
			
		}else{
			$this -> ret = ['error' => TRUE, 'error_data' => ['form_invalid', $check[0]]];
		}
		
	}

	//  Mostra o formulário para a adição ou edição
	private function add_edit_form($data){
		
		$html = @file_get_contents('form_registro.html');
		$val = [];

		if ($html){

			//  Adiciona
			if ($data[tipo] == 'add'){

				$val = [
					'acao' => 'add_edit', 'tipo' => 'add', 'id' => '', 
					'titulo' => 'Adicionar Registro', 'nome' => '', 'dob' => '', 'cep_01' => '',
					'cep_02' => '',	'endereco' => '', 'numero' => '', 'complemento' => '',
					'bairro' => '', 'cidade' => ''
				];

			//  Edit 	
			}else{

				$query = sprintf('SELECT * FROM %s.cl_dados WHERE id = ? LIMIT 1', $this -> db -> config['db']);
				$dados = $this -> db -> query($query, [$data['id']]);

				if (!$this -> db -> error){
					
					$val = $dados[0];
					$val['titulo'] = sprintf('Editar Registro #%d', $data['id']);
					if ($val['numero'] == 0) $val['numero'] = '';
					list($val['cep_01'], $val['cep_02']) = explode('-', $val['cep']);
					$this -> ret['sexo'] = $val['sexo'];
					$this -> ret['uf'] = $val['uf'];					
					
				}else{
					$this -> ret = ['error' => TRUE, 'error_data' => $this -> db -> error_data];
				}

			}

			foreach ($val as $k => $v){
				$html = str_replace('%'. $k. '%', $v, $html);
			}
			
			$this -> ret['html'] = $html;
			
		}else{
			$this -> ret = ['error' => TRUE, 'error_data' => ['html_not_found', ' O formulário não foi encontrado']];
		}
		
	}

	//  Faz a query no servidor
	private function browse($data){

		$el = ['id', 'nome', 'cidade', 'uf', 'lat', 'lon'];		
		$query = sprintf('SELECT %s FROM %s.cl_dados ', implode(', ', $el), $this -> db -> config['db']);
		$params = [];

		if (isset($data['q']) && strlen($data['q']) >= 2){

			$query .= 'WHERE ';

			//  UF
			if (strlen($data['q']) == 2){
				
				$query .= 'uf = ? ';
				$params[] = strtoupper($data['q']);

			//  BUSCA	
			}else{

				$like = [];

				foreach (['nome', 'cidade'] as $campo){
					
					$like[] = vsprintf('%s LIKE ? OR %s LIKE ? OR %s LIKE ? ', array_fill(0, 3, $campo));
					$params = array_merge($params, ['%'. $data['q'], '%'. $data['q']. '%', $data['q']. '%']);
					
				}

				$query .= implode('OR ', $like);
				
			}			
			
		}

		//  Order
		$query .= vsprintf('ORDER BY %s %s ', explode('-', $data['order']));

		//  Limit / offset
		$query .= sprintf('LIMIT %d OFFSET %d', $data['lmt'], $data['offset']);

		//  Realiza a query
	    $this -> ret['data'] = $this -> db -> query($query, $params);
		
	}

	//  Confere os dados antes de adicionar ao banco de dados
	private function check($data){

		$r = [FALSE, [], FALSE];

		//  Nome com mais de 3 caracteres
		if (isset($data['nome']) && strlen(trim($data['nome'])) >= 3){
			$r[1][] = trim($data['nome']);
		}else{
			$r[0] = 'Informe um nome com mais de três caracteres';
		}

		//  Sexo
		if (isset($data['sexo']) && ($data['sexo'] == 'f' || $data['sexo'] == 'm')){
			$r[1][] = $data['sexo'];
		}else{
			$r[0] = 'Selecione o gênero';
		}

		//  DOB
		if (isset($data['dob'])){
			$ymd = explode('-', $data['dob']);
			if (checkdate($ymd[1], $ymd[2], $ymd[0])){
				$r[1][] = $data['dob'];
			}else{
				$r[0] = 'Data de Nascimento Inválida';
			}
		}else{
			$r[0] = 'Informe a data de nascimento';
		}

		//  Os demais campos não precisam ser obrigatórios
		if (!$r[0]){

			//  CEP
			if (isset($data['cep_01']) && isset($data['cep_02']) &&
				strlen($data['cep_01']) == 5 && strlen($data['cep_02']) == 3){
				$r[1][] = $data['cep_01']. '-'. $data['cep_02'];
			}else{
				$r[1][] = NULL;
			}

			$r[1][] = isset($data['endereco']) ? $data['endereco'] : '';
			$r[1][] = (isset($data['numero']) && is_numeric($data['numero'])) ? intval($data['numero']) : 0;
			$r[1][] = isset($data['complemento']) ? $data['complemento'] : '';
			$r[1][] = isset($data['bairro']) ? $data['bairro'] : '';
			$r[1][] = isset($data['cidade']) ? $data['cidade'] : '';
			$r[1][] = isset($data['uf']) ? $data['uf'] : '';

			//  Endereço para o cálculo de latitude e longitude
			$latlon = [];
			
			foreach ([5, 4, 8, 9, 3] as $k){
				
				if (($k == 5 && $r[1][5] > 0) OR strlen($r[1][$k]) >= 2){
					$latlon[] = $k == 9 ? $this -> uf[$r[1][$k]] : $r[1][$k];
				}
				
			}

			//  Leva em conta que existem ao menos 3 dados para fazer a query
			if (count($latlon) >= 3){
				$r[2] = urlencode(implode(' ', $latlon));
			}

		}

		return $r;

	}

	//  Remove o registro
	private function delete($data){

		if (isset($data['id']) && is_numeric($data['id'])){

			$query = sprintf('DELETE FROM %s.cl_dados WHERE ID = ? LIMIT 1', $this -> db -> config['db']);

			if ($this -> db -> query($query, [$data['id']])){
				$this -> ret['msg_01'] = 'Registro removido com sucesso';					
			}else{
				$this -> ret = ['error' => TRUE, 'error_data' => $this -> db -> error_data];
			}
			
		}else{
			$this -> ret = ['error' => TRUE, 'error_data' => ['invalid', 'Dados Inválidos']];
		}
		
		
	}


	//  Tenta achar a latitude e a longitude do endereço informado
	private function geocode($query){

		$url = sprintf($this -> mb_url, $query, $this -> mb_key);
		
		//  Tenta file_get_contents, se não der, tenta CURL
		$result = @file_get_contents($url);

		if (!$result){

			$ch = curl_init();
			curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, FALSE);
			curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);
			curl_setopt($ch, CURLOPT_URL, $url);
			$result = curl_exec($ch);
			curl_close($ch);

		}

		if ($result){
			
			$json = json_decode($result, TRUE);

			//  Relevance maior do que 0.7, center no resultado
			//  retorna a array reversa para LAT ir primeiro como no db
			if (count($json['features']) &&
				$json['features'][0]['relevance'] > 0.7 &&
				isset($json['features'][0]['center'])){				
				return array_reverse($json['features'][0]['center']);									 
			}else{
				return[0, 0];
			}
				
		}else{
			return [0, 0];
		}
		
	}

}

new Dados();

?>
